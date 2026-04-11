
from pathlib import Path
import duckdb

BASE_DIR = Path(__file__).resolve().parent
CSV_PATH = BASE_DIR / 'superstore.csv'
DB_PATH = BASE_DIR / 'superstore.duckdb'

if not CSV_PATH.exists():
    raise SystemExit(f'CSV not found: {CSV_PATH}')

con = duckdb.connect(str(DB_PATH))
con.execute('DROP TABLE IF EXISTS orders')
con.execute(f"""
CREATE TABLE orders AS
SELECT 
  CAST("Order Date" AS DATE) AS order_date,
  CAST(Sales AS DOUBLE) AS sales,
  CAST(Profit AS DOUBLE) AS profit,
  CAST(Quantity AS INTEGER) AS quantity,
  CAST(Discount AS DOUBLE) AS discount,
  "Customer ID" AS customer_id,
  "Order ID" AS order_id,
  Region AS region,
  "State/Province" AS state_province,
  Segment AS segment,
  "Ship Mode" AS ship_mode,
  "Sub-Category" AS sub_category
FROM read_csv_auto('{CSV_PATH.as_posix()}', header=true)
""")
rows = con.execute('SELECT COUNT(*) FROM orders').fetchone()[0]
con.close()
print(f'Created {DB_PATH} with {rows} rows in table orders')
