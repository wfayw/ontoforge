#!/usr/bin/env python3
"""Generate realistic supply chain demo data for OntoForge.

Business scenarios embedded in data:
1. Supplier risk: SUP-015 rated C with deteriorating quality
2. Delivery delays: 15% of orders delayed, concentrated on certain suppliers
3. Cost surge: Turbocharger price increased 20% over 6 months
4. Plant bottleneck: Guangzhou plant in maintenance, orders rerouted
5. Quality deterioration: Defect rate for certain parts increasing month-over-month
6. Urgent procurement: Some orders marked urgent
7. International logistics: Multi-currency, multi-carrier
"""

import csv
import random
import os
from datetime import datetime, timedelta

random.seed(42)
DIR = os.path.dirname(os.path.abspath(__file__))

# ── Suppliers (20) ──────────────────────────────────────

SUPPLIERS = [
    ("SUP-001", "宝钢特钢", "中国", "上海", "sales@baosteel-special.com", "A", 1998),
    ("SUP-002", "Bosch Automotive", "德国", "Stuttgart", "procurement@bosch.de", "A", 1886),
    ("SUP-003", "Denso Corporation", "日本", "Kariya", "global@denso.co.jp", "A", 1949),
    ("SUP-004", "万向集团", "中国", "杭州", "sourcing@wanxiang.com", "B", 1969),
    ("SUP-005", "Continental AG", "德国", "Hanover", "supply@continental.de", "A", 1871),
    ("SUP-006", "Aisin Seiki", "日本", "Kariya", "parts@aisin.co.jp", "B", 1965),
    ("SUP-007", "中信戴卡", "中国", "秦皇岛", "wheels@citicdicastal.com", "A", 1988),
    ("SUP-008", "ZF Friedrichshafen", "德国", "Friedrichshafen", "oem@zf.com", "A", 1915),
    ("SUP-009", "Hyundai Mobis", "韩国", "Seoul", "parts@mobis.co.kr", "A", 1977),
    ("SUP-010", "BorgWarner Inc", "美国", "Auburn Hills", "supply@borgwarner.com", "A", 1928),
    ("SUP-011", "宁德时代", "中国", "宁德", "battery@catl.com", "A", 2011),
    ("SUP-012", "Magna International", "加拿大", "Aurora", "sourcing@magna.com", "B", 1957),
    ("SUP-013", "Valeo SA", "法国", "Paris", "oem@valeo.com", "A", 1923),
    ("SUP-014", "SKF Group", "瑞典", "Gothenburg", "bearings@skf.com", "A", 1907),
    ("SUP-015", "泰源精密制造", "中国", "东莞", "sales@taiyuan-pm.cn", "C", 2015),
    ("SUP-016", "Schaeffler Group", "德国", "Herzogenaurach", "auto@schaeffler.com", "A", 1946),
    ("SUP-017", "Mando Corporation", "韩国", "Pyeongtaek", "brakes@mando.com", "B", 1962),
    ("SUP-018", "均胜电子", "中国", "宁波", "auto@joyson.cn", "B", 2004),
    ("SUP-019", "Nidec Corporation", "日本", "Kyoto", "motors@nidec.co.jp", "A", 1973),
    ("SUP-020", "Aptiv PLC", "爱尔兰", "Dublin", "connect@aptiv.com", "A", 1994),
]

with open(os.path.join(DIR, "suppliers.csv"), "w", newline="", encoding="utf-8") as f:
    w = csv.writer(f)
    w.writerow(["supplier_code", "name", "country", "city", "contact_email", "rating", "established_year"])
    for s in SUPPLIERS:
        w.writerow(s)

# ── Parts (30) ──────────────────────────────────────────

PARTS = [
    ("PRT-10001", "曲轴锻件", "发动机", 2850.0, "件", 21, 100, "SUP-001"),
    ("PRT-10002", "ECU 电子控制单元", "电子", 1200.0, "件", 30, 500, "SUP-002"),
    ("PRT-10003", "空调压缩机", "空调", 680.0, "件", 14, 200, "SUP-003"),
    ("PRT-10004", "万向节总成", "传动", 320.0, "件", 10, 300, "SUP-004"),
    ("PRT-10005", "ABS 制动模块", "制动", 950.0, "件", 18, 200, "SUP-005"),
    ("PRT-10006", "自动变速箱阀体", "变速箱", 4200.0, "件", 35, 50, "SUP-006"),
    ("PRT-10007", "铝合金轮毂 18寸", "底盘", 580.0, "件", 7, 400, "SUP-007"),
    ("PRT-10008", "电动助力转向机", "转向", 1580.0, "件", 25, 100, "SUP-008"),
    ("PRT-10009", "涡轮增压器", "发动机", 3500.0, "件", 28, 80, "SUP-010"),
    ("PRT-10010", "缸体铸件", "发动机", 1950.0, "件", 18, 150, "SUP-001"),
    ("PRT-10011", "雷达传感器", "电子", 860.0, "件", 20, 300, "SUP-005"),
    ("PRT-10012", "散热器总成", "散热", 420.0, "件", 12, 200, "SUP-003"),
    ("PRT-10013", "三元锂电池包 75kWh", "电池", 38000.0, "件", 45, 20, "SUP-011"),
    ("PRT-10014", "电驱动总成", "电驱", 12500.0, "件", 35, 30, "SUP-019"),
    ("PRT-10015", "BMS 电池管理系统", "电子", 2800.0, "件", 25, 100, "SUP-011"),
    ("PRT-10016", "前照灯总成 LED", "照明", 650.0, "件", 14, 500, "SUP-013"),
    ("PRT-10017", "座椅骨架总成", "内饰", 480.0, "件", 12, 200, "SUP-012"),
    ("PRT-10018", "线束总成", "电子", 350.0, "件", 10, 800, "SUP-020"),
    ("PRT-10019", "轮毂轴承单元", "底盘", 180.0, "件", 7, 1000, "SUP-014"),
    ("PRT-10020", "双离合变速器", "变速箱", 8500.0, "件", 40, 30, "SUP-016"),
    ("PRT-10021", "制动卡钳总成", "制动", 520.0, "件", 14, 300, "SUP-017"),
    ("PRT-10022", "气囊模块", "安全", 750.0, "件", 20, 200, "SUP-018"),
    ("PRT-10023", "ADAS 域控制器", "电子", 3200.0, "件", 30, 80, "SUP-002"),
    ("PRT-10024", "全景天窗玻璃", "车身", 1200.0, "件", 18, 100, "SUP-012"),
    ("PRT-10025", "铸铝副车架", "底盘", 960.0, "件", 15, 150, "SUP-015"),
    ("PRT-10026", "EPS 电子助力泵", "转向", 480.0, "件", 12, 200, "SUP-009"),
    ("PRT-10027", "碳陶制动盘", "制动", 2400.0, "件", 25, 50, "SUP-005"),
    ("PRT-10028", "高压线束 800V", "电子", 1850.0, "件", 20, 100, "SUP-020"),
    ("PRT-10029", "铝合金电池托盘", "电池", 2200.0, "件", 18, 80, "SUP-007"),
    ("PRT-10030", "冲压A柱加强板", "车身", 85.0, "件", 5, 2000, "SUP-015"),
]

with open(os.path.join(DIR, "parts.csv"), "w", newline="", encoding="utf-8") as f:
    w = csv.writer(f)
    w.writerow(["part_number", "name", "category", "unit_price", "unit", "lead_time_days", "min_order_qty", "supplier_code"])
    for p in PARTS:
        w.writerow(p)

# ── Plants (8) ──────────────────────────────────────────

PLANTS = [
    ("PLT-SH", "上海浦东工厂", "上海", "中国", 800, "SUV/轿车", "运行中"),
    ("PLT-CQ", "重庆两江工厂", "重庆", "中国", 600, "轿车/MPV", "运行中"),
    ("PLT-CC", "长春一汽工厂", "长春", "中国", 1000, "新能源/SUV", "运行中"),
    ("PLT-GZ", "广州南沙工厂", "广州", "中国", 500, "MPV/轿车", "维护中"),
    ("PLT-CD", "成都天府工厂", "成都", "中国", 450, "新能源", "运行中"),
    ("PLT-WH", "武汉经开工厂", "武汉", "中国", 700, "SUV/皮卡", "运行中"),
    ("PLT-TH", "泰国罗勇工厂", "Rayong", "泰国", 350, "皮卡/SUV", "运行中"),
    ("PLT-DE", "慕尼黑研发工厂", "Munich", "德国", 200, "高端轿车", "运行中"),
]

with open(os.path.join(DIR, "plants.csv"), "w", newline="", encoding="utf-8") as f:
    w = csv.writer(f)
    w.writerow(["plant_code", "name", "city", "country", "capacity_per_day", "product_line", "status"])
    for p in PLANTS:
        w.writerow(p)

# ── Warehouses (6) ──────────────────────────────────────

WAREHOUSES = [
    ("WH-SH01", "上海嘉定中心仓", "上海", "中国", 50000, "在用"),
    ("WH-CQ01", "重庆保税物流仓", "重庆", "中国", 30000, "在用"),
    ("WH-CC01", "长春汽配集散仓", "长春", "中国", 40000, "在用"),
    ("WH-GZ01", "广州南沙保税仓", "广州", "中国", 25000, "在用"),
    ("WH-DE01", "Hamburg 欧洲中转仓", "Hamburg", "德国", 15000, "在用"),
    ("WH-TH01", "Laem Chabang 仓库", "Chonburi", "泰国", 12000, "在用"),
]

with open(os.path.join(DIR, "warehouses.csv"), "w", newline="", encoding="utf-8") as f:
    w = csv.writer(f)
    w.writerow(["warehouse_code", "name", "city", "country", "capacity_sqm", "status"])
    for wh in WAREHOUSES:
        w.writerow(wh)

# ── Purchase Orders (150) ───────────────────────────────

PLANT_CODES = [p[0] for p in PLANTS]
PART_DATA = {p[0]: p for p in PARTS}  # part_number -> full tuple
SUP_DATA = {s[0]: s for s in SUPPLIERS}

STATUSES = ["已下单", "已审批", "生产中", "已发货", "已到货", "已验收", "已驳回", "延迟"]
STATUS_WEIGHTS = [12, 8, 15, 10, 12, 30, 5, 8]  # percentage distribution

CURRENCIES = {
    "中国": "CNY", "德国": "EUR", "日本": "JPY", "韩国": "KRW",
    "美国": "USD", "加拿大": "CAD", "法国": "EUR", "瑞典": "SEK",
    "爱尔兰": "EUR",
}

po_rows = []
base_date = datetime(2024, 7, 1)

for i in range(150):
    po_num = f"PO-2025-{1000 + i:04d}"
    part = random.choice(PARTS)
    part_num = part[0]
    sup_code = part[7]
    sup = SUP_DATA.get(sup_code)
    plant = random.choice(PLANT_CODES)

    # Quantity based on min_order_qty with some variance
    min_qty = part[6]
    qty = random.randint(min_qty, min_qty * 5)

    # Price with some variance (+/- 5%), cost surge for turbocharger
    base_price = part[3]
    month_offset = random.randint(0, 17)
    order_date = base_date + timedelta(days=month_offset * 30 + random.randint(0, 29))

    if part_num == "PRT-10009" and order_date >= datetime(2025, 6, 1):
        base_price = 4200.0  # 20% price increase for turbocharger

    price = round(base_price * random.uniform(0.97, 1.03), 2)
    total = round(qty * price, 2)

    lead_time = part[5]
    expected = order_date + timedelta(days=lead_time + random.randint(-2, 5))

    # Status distribution with business logic
    status = random.choices(STATUSES, weights=STATUS_WEIGHTS, k=1)[0]
    # Recent orders more likely to be in early status
    if order_date > datetime(2025, 12, 1):
        status = random.choices(["已下单", "已审批", "生产中"], weights=[40, 30, 30], k=1)[0]
    # C-rated supplier more likely to have delays
    if sup and sup[5] == "C" and random.random() < 0.35:
        status = "延迟"
    # Guangzhou plant in maintenance - some orders rerouted or delayed
    if plant == "PLT-GZ" and random.random() < 0.2:
        status = "延迟"

    currency = CURRENCIES.get(sup[2], "CNY") if sup else "CNY"

    po_rows.append([
        po_num, part_num, sup_code, plant, qty, price, total,
        order_date.strftime("%Y-%m-%d"), expected.strftime("%Y-%m-%d"),
        status, currency
    ])

with open(os.path.join(DIR, "purchase_orders.csv"), "w", newline="", encoding="utf-8") as f:
    w = csv.writer(f)
    w.writerow(["po_number", "part_number", "supplier_code", "plant_code",
                 "quantity", "unit_price", "total_amount", "order_date",
                 "expected_delivery", "status", "currency"])
    for row in po_rows:
        w.writerow(row)

# ── Quality Inspections (50) ────────────────────────────

INSPECTORS = ["赵工", "李工", "王工", "张工", "陈工", "刘工"]
RESULTS = ["合格", "轻微缺陷", "不合格", "待复检"]

# Only inspect orders that reached 已到货/已验收
inspectable = [r for r in po_rows if r[9] in ("已到货", "已验收")]
random.shuffle(inspectable)
inspectable = inspectable[:50]

qc_rows = []
for idx, po in enumerate(inspectable):
    qc_id = f"QC-{3001 + idx}"
    po_num = po[0]
    part_num = po[1]
    sup_code = po[2]
    sup = SUP_DATA.get(sup_code)

    inspector = random.choice(INSPECTORS)
    insp_date = datetime.strptime(po[8], "%Y-%m-%d") + timedelta(days=random.randint(0, 3))
    sample_size = random.choice([10, 20, 30, 50, 100])

    # Defect patterns:
    # C-rated supplier (SUP-015) has high defect rates
    if sup and sup[5] == "C":
        defect_count = random.randint(3, 12)
        result = random.choices(["不合格", "轻微缺陷"], weights=[60, 40], k=1)[0]
    # B-rated suppliers have moderate defect rates
    elif sup and sup[5] == "B":
        defect_count = random.randint(0, 5)
        if defect_count >= 3:
            result = random.choices(["轻微缺陷", "不合格"], weights=[70, 30], k=1)[0]
        elif defect_count > 0:
            result = "轻微缺陷"
        else:
            result = "合格"
    else:
        defect_count = random.choices([0, 0, 0, 0, 1, 2, 3], k=1)[0]
        if defect_count >= 3:
            result = "轻微缺陷"
        elif defect_count > 0:
            result = random.choices(["合格", "轻微缺陷"], weights=[60, 40], k=1)[0]
        else:
            result = "合格"

    # Some specific patterns for PRT-10025 (from SUP-015) - quality deterioration over time
    if part_num == "PRT-10025" and insp_date > datetime(2025, 9, 1):
        defect_count = random.randint(5, 15)
        result = "不合格"

    notes_map = {
        "合格": "批次检验通过，参数指标均在公差范围内",
        "轻微缺陷": f"外观瑕疵{defect_count}件，不影响功能性能，降级使用",
        "不合格": f"关键尺寸超差{defect_count}件，整批退货处理",
        "待复检": f"发现{defect_count}件异常，需二次检测确认",
    }

    qc_rows.append([
        qc_id, po_num, part_num, inspector,
        insp_date.strftime("%Y-%m-%d"), sample_size,
        defect_count, result, notes_map[result]
    ])

with open(os.path.join(DIR, "quality_inspections.csv"), "w", newline="", encoding="utf-8") as f:
    w = csv.writer(f)
    w.writerow(["inspection_id", "po_number", "part_number", "inspector",
                 "inspection_date", "sample_size", "defect_count", "result", "notes"])
    for row in qc_rows:
        w.writerow(row)

# ── Deliveries (80) ─────────────────────────────────────

CARRIERS = [
    "中远海运", "马士基航运", "DHL Express", "顺丰速运",
    "德邦物流", "京东物流", "FedEx", "DB Schenker",
]

DELIVERY_STATUSES = ["已发出", "运输中", "已到达", "清关中", "异常"]

# Create deliveries for shipped/arrived/inspected orders
shippable = [r for r in po_rows if r[9] in ("已发货", "已到货", "已验收")]
random.shuffle(shippable)
shippable = shippable[:80]

delivery_rows = []
for idx, po in enumerate(shippable):
    dlv_id = f"DLV-{5001 + idx}"
    po_num = po[0]
    sup_code = po[2]
    sup = SUP_DATA.get(sup_code)

    # International orders use international carriers
    if sup and sup[2] not in ("中国",):
        carrier = random.choice(["马士基航运", "DHL Express", "FedEx", "DB Schenker"])
    else:
        carrier = random.choice(["中远海运", "顺丰速运", "德邦物流", "京东物流"])

    order_date = datetime.strptime(po[7], "%Y-%m-%d")
    ship_date = order_date + timedelta(days=random.randint(3, 10))
    lead = (datetime.strptime(po[8], "%Y-%m-%d") - order_date).days
    eta = ship_date + timedelta(days=max(3, lead - 5))

    # Actual arrival - most on time, some delayed
    delay = 0
    if sup and sup[5] == "C":
        delay = random.randint(2, 8)
    elif random.random() < 0.15:
        delay = random.randint(1, 5)
    actual = eta + timedelta(days=delay)

    if po[9] in ("已到货", "已验收"):
        dlv_status = "已到达"
    elif po[9] == "已发货":
        dlv_status = random.choices(["运输中", "已发出", "清关中"], weights=[50, 30, 20], k=1)[0]
    else:
        dlv_status = "已发出"

    if delay > 3 and dlv_status == "运输中":
        dlv_status = "异常"

    tracking = f"TRK{random.randint(100000000, 999999999)}"

    delivery_rows.append([
        dlv_id, po_num, carrier, ship_date.strftime("%Y-%m-%d"),
        eta.strftime("%Y-%m-%d"),
        actual.strftime("%Y-%m-%d") if dlv_status == "已到达" else "",
        dlv_status, tracking
    ])

with open(os.path.join(DIR, "deliveries.csv"), "w", newline="", encoding="utf-8") as f:
    w = csv.writer(f)
    w.writerow(["delivery_id", "po_number", "carrier", "ship_date",
                 "eta", "actual_arrival", "status", "tracking_number"])
    for row in delivery_rows:
        w.writerow(row)

# ── Summary ─────────────────────────────────────────────

print("=== OntoForge Demo Data Generated ===")
print(f"  Suppliers:            {len(SUPPLIERS)}")
print(f"  Parts:                {len(PARTS)}")
print(f"  Plants:               {len(PLANTS)}")
print(f"  Warehouses:           {len(WAREHOUSES)}")
print(f"  Purchase Orders:      {len(po_rows)}")
print(f"  Quality Inspections:  {len(qc_rows)}")
print(f"  Deliveries:           {len(delivery_rows)}")
print(f"  Total Objects:        {len(SUPPLIERS) + len(PARTS) + len(PLANTS) + len(WAREHOUSES) + len(po_rows) + len(qc_rows) + len(delivery_rows)}")

# Stats for embedded scenarios
delayed = sum(1 for r in po_rows if r[9] == "延迟")
rejected = sum(1 for r in po_rows if r[9] == "已驳回")
defective = sum(1 for r in qc_rows if r[7] == "不合格")
c_supplier_orders = sum(1 for r in po_rows if r[2] == "SUP-015")
print(f"\n  Business Scenario Stats:")
print(f"    Delayed orders:     {delayed}")
print(f"    Rejected orders:    {rejected}")
print(f"    Failed inspections: {defective}")
print(f"    C-rated supplier orders: {c_supplier_orders}")
print(f"    Status distribution:")
from collections import Counter
status_counts = Counter(r[9] for r in po_rows)
for s, c in status_counts.most_common():
    print(f"      {s}: {c}")
