
from fastapi import FastAPI, HTTPException, Query
from fastapi.middleware.cors import CORSMiddleware
import duckdb
from pathlib import Path

BASE_DIR = Path(__file__).resolve().parent
DB_PATH = BASE_DIR / "superstore.duckdb"

app = FastAPI(title="Superstore DuckDB Dashboard API")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

AVAILABLE_MONTHS = [
    f"{year}-{month:02d}"
    for year in range(2023, 2027)
    for month in range(1, 13)
]

REGIONS = ["West", "South", "East", "Central"]
SUBCATEGORIES = [
    "Accessories", "Appliances", "Binders", "Bookcases", "Chairs", "Copiers",
    "Furnishings", "Machines", "Paper", "Phones", "Storage", "Tables"
]
SEGMENT_ORDER = [
    "Champions",
    "Loyal Customers",
    "New Customers",
    "Needs Attention",
    "Lost Customers",
    "At Risk",
]


def get_conn():
    if not DB_PATH.exists():
        raise HTTPException(status_code=500, detail=f"DuckDB database not found: {DB_PATH}")
    return duckdb.connect(str(DB_PATH), read_only=True)


def normalize_month(month: str) -> str:
    if month not in AVAILABLE_MONTHS:
        raise HTTPException(
            status_code=400,
            detail=f"Invalid month '{month}'. Expected YYYY-MM from 2023-01 to 2026-12."
        )
    return month


def rows_to_month_map(rows, value_key):
    return [{"month": r[0], value_key: float(r[1] or 0)} for r in rows]


@app.get("/")
def root():
    return {
        "ok": True,
        "message": "Superstore DuckDB backend is running",
        "database": str(DB_PATH),
        "endpoints": ["/api/health", "/api/dashboard?month=2026-02"],
    }


@app.get("/api/health")
def health():
    try:
        with get_conn() as conn:
            count = conn.execute("SELECT COUNT(*) FROM orders").fetchone()[0]
            columns = [r[1] for r in conn.execute("PRAGMA table_info('orders')").fetchall()]
        return {"ok": True, "rows": count, "columns": columns}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.get("/api/dashboard")
def dashboard(month: str = Query("2026-02")):
    selected_month = normalize_month(month)
    selected_month_start = f"{selected_month}-01"

    try:
        with get_conn() as conn:
            # KPI sparkline data (same as original: last 6 months ending at selected month)
            kpi_rows = conn.execute(
                """
                SELECT strftime(date_trunc('month', order_date), '%Y-%m') AS month,
                       ROUND(SUM(sales), 0) AS sales,
                       ROUND(SUM(profit), 0) AS profit,
                       SUM(quantity) AS quantity,
                       ROUND(AVG(discount) * 100, 1) AS discount,
                       ROUND(SUM(profit) / NULLIF(SUM(sales), 0) * 100, 1) AS profitRatio
                FROM orders
                WHERE order_date >= date_trunc('month', ?::DATE) - INTERVAL '5 months'
                  AND order_date <  date_trunc('month', ?::DATE) + INTERVAL '1 month'
                GROUP BY 1
                ORDER BY 1
                """,
                [selected_month_start, selected_month_start],
            ).fetchall()

            kpi_data = [
                {
                    "month": r[0],
                    "sales": float(r[1] or 0),
                    "profit": float(r[2] or 0),
                    "quantity": float(r[3] or 0),
                    "discount": float(r[4] or 0),
                    "profitRatio": float(r[5] or 0),
                }
                for r in kpi_rows
            ]
            current = kpi_data[-1] if kpi_data else {"sales": 0, "profit": 0, "quantity": 0, "discount": 0, "profitRatio": 0}
            prior = kpi_data[-2] if len(kpi_data) > 1 else {"sales": 0, "profit": 0, "quantity": 0, "discount": 0, "profitRatio": 0}

            # Sales per customer
            spc_current_row = conn.execute(
                """
                SELECT ROUND(SUM(sales) / NULLIF(COUNT(DISTINCT customer_id), 0), 0) AS spc
                FROM orders
                WHERE strftime(date_trunc('month', order_date), '%Y-%m') = ?
                """,
                [selected_month],
            ).fetchone()

            spc_target_row = conn.execute(
                """
                SELECT ROUND(AVG(month_spc) * 1.25, 0) AS target
                FROM (
                    SELECT strftime(date_trunc('month', order_date), '%Y-%m') AS month,
                           SUM(sales) / NULLIF(COUNT(DISTINCT customer_id), 0) AS month_spc
                    FROM orders
                    WHERE order_date >= date_trunc('month', ?::DATE) - INTERVAL '11 months'
                      AND order_date <  date_trunc('month', ?::DATE) + INTERVAL '1 month'
                    GROUP BY 1
                ) t
                """,
                [selected_month_start, selected_month_start],
            ).fetchone()

            sales_per_customer = {
                "spc": float((spc_current_row[0] if spc_current_row else 0) or 0),
                "target": float((spc_target_row[0] if spc_target_row else 0) or 0),
            }

            # Regional Sales - revert to original-style logic:
            # quarter-based, fixed history from 2024-01-01, not tied to selected month.
            regional_rows = conn.execute(
                """
                SELECT strftime(date_trunc('quarter', order_date), '%Y-%m') AS month,
                       region,
                       ROUND(SUM(sales), 0) AS sales
                FROM orders
                WHERE order_date >= DATE '2024-01-01'
                GROUP BY 1, 2
                ORDER BY 1, 2
                """
            ).fetchall()

            regional_map = {}
            for month_key, region, sales in regional_rows:
                if month_key not in regional_map:
                    regional_map[month_key] = {"month": month_key, **{r: 0 for r in REGIONS}}
                regional_map[month_key][region] = float(sales or 0)
            regional_data = list(regional_map.values())

            # State-wise Sales - keep selected month
            state_rows = conn.execute(
                """
                SELECT state_province, ROUND(SUM(sales), 0) AS sales
                FROM orders
                WHERE strftime(date_trunc('month', order_date), '%Y-%m') = ?
                GROUP BY 1
                ORDER BY sales DESC
                LIMIT 12
                """,
                [selected_month],
            ).fetchall()
            state_data = [{"name": r[0], "value": float(r[1] or 0)} for r in state_rows]

            # Order Distribution
            segment_rows = conn.execute(
                """
                SELECT segment, COUNT(DISTINCT order_id) AS orders
                FROM orders
                WHERE strftime(date_trunc('month', order_date), '%Y-%m') = ?
                GROUP BY 1 ORDER BY 2 DESC
                """,
                [selected_month],
            ).fetchall()
            ship_rows = conn.execute(
                """
                SELECT ship_mode, COUNT(DISTINCT order_id) AS orders
                FROM orders
                WHERE strftime(date_trunc('month', order_date), '%Y-%m') = ?
                GROUP BY 1 ORDER BY 2 DESC
                """,
                [selected_month],
            ).fetchall()
            chord_rows = conn.execute(
                """
                SELECT segment, ship_mode, COUNT(DISTINCT order_id) AS orders
                FROM orders
                WHERE strftime(date_trunc('month', order_date), '%Y-%m') = ?
                GROUP BY 1, 2
                ORDER BY 3 DESC
                """,
                [selected_month],
            ).fetchall()
            segment_data = [{"name": r[0], "orders": int(r[1] or 0)} for r in segment_rows]
            ship_mode_data = [{"name": r[0], "orders": int(r[1] or 0)} for r in ship_rows]
            chord_data = [{"segment": r[0], "shipMode": r[1], "orders": int(r[2] or 0)} for r in chord_rows]

            # Customer Segmentation - return original dashboard format:
            # radarData with category names + rfmScores with recency/frequency/monetary.
            # We compute dynamic counts using a 12-month window ending at selected month,
            # and compare with the prior 12-month window.
            def segmentation_query(ref_start_expr: str, ref_end_expr: str):
                return f"""
                WITH customer_metrics AS (
                    SELECT
                        customer_id,
                        datediff('day', MAX(order_date), {ref_end_expr}) AS recency_days,
                        COUNT(DISTINCT order_id) AS frequency,
                        SUM(sales) AS monetary,
                        MIN(order_date) AS first_order_date
                    FROM orders
                    WHERE order_date >= {ref_start_expr}
                      AND order_date <= {ref_end_expr}
                    GROUP BY 1
                ),
                scored AS (
                    SELECT *,
                        NTILE(5) OVER (ORDER BY recency_days DESC) AS recency_score,
                        NTILE(5) OVER (ORDER BY frequency ASC) AS frequency_score,
                        NTILE(5) OVER (ORDER BY monetary ASC) AS monetary_score
                    FROM customer_metrics
                ),
                labelled AS (
                    SELECT *,
                        CASE
                            WHEN recency_score >= 4 AND frequency_score >= 4 AND monetary_score >= 4 THEN 'Champions'
                            WHEN recency_score >= 3 AND frequency_score >= 4 THEN 'Loyal Customers'
                            WHEN recency_score >= 4 AND frequency_score <= 2 THEN 'New Customers'
                            WHEN recency_score = 3 AND frequency_score BETWEEN 2 AND 3 THEN 'Needs Attention'
                            WHEN recency_score <= 2 AND monetary_score >= 3 THEN 'At Risk'
                            WHEN recency_score <= 2 AND frequency_score <= 2 THEN 'Lost Customers'
                            ELSE 'Needs Attention'
                        END AS segment_name
                    FROM scored
                )
                SELECT segment_name, COUNT(*) AS customers
                FROM labelled
                GROUP BY 1
                """

            current_seg_rows = conn.execute(
                segmentation_query(
                    "date_trunc('month', ?::DATE) - INTERVAL '11 months'",
                    "date_trunc('month', ?::DATE) + INTERVAL '1 month' - INTERVAL '1 day'",
                ),
                [selected_month_start, selected_month_start, selected_month_start],
            ).fetchall()

            prior_seg_rows = conn.execute(
                segmentation_query(
                    "date_trunc('month', ?::DATE) - INTERVAL '23 months'",
                    "date_trunc('month', ?::DATE) - INTERVAL '12 months' + INTERVAL '1 month' - INTERVAL '1 day'",
                ),
                [selected_month_start, selected_month_start, selected_month_start],
            ).fetchall()

            current_seg_map = {r[0]: int(r[1] or 0) for r in current_seg_rows}
            prior_seg_map = {r[0]: int(r[1] or 0) for r in prior_seg_rows}

            radar_data = [
                {
                    "segment": seg.replace(" Customers", "\nCustomers") if "Customers" in seg else seg,
                    "currentYear": current_seg_map.get(seg, 0),
                    "priorYear": prior_seg_map.get(seg, 0),
                }
                for seg in SEGMENT_ORDER
            ]

            # RFM score sliders - 12-month window ending at selected month
            rfm_row = conn.execute(
                """
                WITH customer_metrics AS (
                    SELECT
                        customer_id,
                        datediff('day', MAX(order_date), date_trunc('month', ?::DATE) + INTERVAL '1 month' - INTERVAL '1 day') AS recency_days,
                        COUNT(DISTINCT order_id) AS frequency,
                        SUM(sales) AS monetary
                    FROM orders
                    WHERE order_date >= date_trunc('month', ?::DATE) - INTERVAL '11 months'
                      AND order_date <  date_trunc('month', ?::DATE) + INTERVAL '1 month'
                    GROUP BY 1
                ),
                scored AS (
                    SELECT *,
                        NTILE(5) OVER (ORDER BY recency_days DESC) AS recency_score,
                        NTILE(5) OVER (ORDER BY frequency ASC) AS frequency_score,
                        NTILE(5) OVER (ORDER BY monetary ASC) AS monetary_score
                    FROM customer_metrics
                )
                SELECT ROUND(AVG(recency_score), 1),
                       ROUND(AVG(frequency_score), 1),
                       ROUND(AVG(monetary_score), 1)
                FROM scored
                """,
                [selected_month_start, selected_month_start, selected_month_start],
            ).fetchone()

            rfm_scores = {
                "recency": float((rfm_row[0] if rfm_row else 0) or 0),
                "frequency": float((rfm_row[1] if rfm_row else 0) or 0),
                "monetary": float((rfm_row[2] if rfm_row else 0) or 0),
            }

            customer_segmentation = [
                {"metric": "Recency", "current": rfm_scores["recency"], "prior": 0},
                {"metric": "Frequency", "current": rfm_scores["frequency"], "prior": 0},
                {"metric": "Monetary", "current": rfm_scores["monetary"], "prior": 0},
            ]

            # Appliances card - original-style (selected month KPI; trailing trend 12 months)
            appliances_row = conn.execute(
                """
                SELECT ROUND(SUM(sales), 0) AS sales,
                       ROUND(SUM(profit), 0) AS profit,
                       ROUND(SUM(profit) / NULLIF(SUM(sales), 0) * 100, 1) AS profitMargin,
                       COUNT(DISTINCT order_id) AS orders,
                       COUNT(DISTINCT customer_id) AS customers
                FROM orders
                WHERE strftime(date_trunc('month', order_date), '%Y-%m') = ?
                  AND sub_category = 'Appliances'
                """,
                [selected_month],
            ).fetchone()

            appliances_trend_rows = conn.execute(
                """
                SELECT strftime(date_trunc('month', order_date), '%Y-%m') AS month,
                       ROUND(SUM(sales), 0) AS sales
                FROM orders
                WHERE sub_category = 'Appliances'
                  AND order_date >= date_trunc('month', ?::DATE) - INTERVAL '11 months'
                  AND order_date <  date_trunc('month', ?::DATE) + INTERVAL '1 month'
                GROUP BY 1 ORDER BY 1
                """,
                [selected_month_start, selected_month_start],
            ).fetchall()

            appliances = {
                "name": "Appliances",
                "sales": float((appliances_row[0] if appliances_row else 0) or 0),
                "profit": float((appliances_row[1] if appliances_row else 0) or 0),
                "profitMargin": float((appliances_row[2] if appliances_row else 0) or 0),
                "orders": int((appliances_row[3] if appliances_row else 0) or 0),
                "customers": int((appliances_row[4] if appliances_row else 0) or 0),
                "trendData": rows_to_month_map(appliances_trend_rows, "sales"),
            }

            # All Sub-Categories - 12-month trailing monthly lines
            all_subcat_rows = conn.execute(
                """
                SELECT strftime(date_trunc('month', order_date), '%Y-%m') AS month,
                       sub_category,
                       ROUND(SUM(sales), 0) AS sales
                FROM orders
                WHERE order_date >= date_trunc('month', ?::DATE) - INTERVAL '11 months'
                  AND order_date <  date_trunc('month', ?::DATE) + INTERVAL '1 month'
                GROUP BY 1, 2
                ORDER BY 1, 2
                """,
                [selected_month_start, selected_month_start],
            ).fetchall()

            subcat_map = {}
            for month_key, subcat, sales in all_subcat_rows:
                if month_key not in subcat_map:
                    subcat_map[month_key] = {"month": month_key, **{s: 0 for s in SUBCATEGORIES}}
                subcat_map[month_key][subcat] = float(sales or 0)
            all_subcategories = list(subcat_map.values())

            return {
                # old + new shapes together to keep either frontend working
                "selectedMonth": selected_month,
                "availableMonths": AVAILABLE_MONTHS,
                "kpiData": kpi_data,
                "sparklineData": kpi_data,
                "current": current,
                "prior": prior,
                "salesPerCustomer": sales_per_customer,
                "regionalData": regional_data,
                "stateData": state_data,
                "segmentData": segment_data,
                "shipModeData": ship_mode_data,
                "chordData": chord_data,
                "customerSegmentation": customer_segmentation,
                "radarData": radar_data,
                "rfmScores": rfm_scores,
                "appliances": appliances,
                "appliancesMetrics": {
                    "sales": appliances["sales"],
                    "profit": appliances["profit"],
                    "profitMargin": appliances["profitMargin"],
                    "orders": appliances["orders"],
                    "customers": appliances["customers"],
                },
                "appliancesTrend": appliances["trendData"],
                "allSubCategories": all_subcategories,
                "subCategoryTrend": all_subcategories,
            }

    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
