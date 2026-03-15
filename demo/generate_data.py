"""
OntoForge Demo — 制造业供应链管理
生成 Mock 数据，对标 Palantir Foundry 官方供应链优化案例
场景：一家汽车零部件制造商，管理供应商、零件、工厂、采购订单和质量检测
"""
import csv
import os
import random
from datetime import datetime, timedelta

OUT = os.path.dirname(os.path.abspath(__file__))
random.seed(42)

# ── 供应商 Suppliers ──────────────────────────────────
suppliers = [
    {"supplier_code": "SUP-001", "name": "宝钢特钢", "country": "中国", "city": "上海", "contact_email": "sales@baosteel-special.com", "rating": "A", "established_year": 1998},
    {"supplier_code": "SUP-002", "name": "Bosch Automotive", "country": "德国", "city": "Stuttgart", "contact_email": "procurement@bosch.de", "rating": "A", "established_year": 1886},
    {"supplier_code": "SUP-003", "name": "Denso Corporation", "country": "日本", "city": "Kariya", "contact_email": "global@denso.co.jp", "rating": "A", "established_year": 1949},
    {"supplier_code": "SUP-004", "name": "万向集团", "country": "中国", "city": "杭州", "contact_email": "sourcing@wanxiang.com", "rating": "B", "established_year": 1969},
    {"supplier_code": "SUP-005", "name": "Continental AG", "country": "德国", "city": "Hanover", "contact_email": "supply@continental.de", "rating": "A", "established_year": 1871},
    {"supplier_code": "SUP-006", "name": "Aisin Seiki", "country": "日本", "city": "Kariya", "contact_email": "parts@aisin.co.jp", "rating": "B", "established_year": 1965},
    {"supplier_code": "SUP-007", "name": "中信戴卡", "country": "中国", "city": "秦皇岛", "contact_email": "wheels@citicdicastal.com", "rating": "A", "established_year": 1988},
    {"supplier_code": "SUP-008", "name": "ZF Friedrichshafen", "country": "德国", "city": "Friedrichshafen", "contact_email": "oem@zf.com", "rating": "A", "established_year": 1915},
]

# ── 零件 Parts ────────────────────────────────────────
parts = [
    {"part_number": "PRT-10001", "name": "曲轴锻件", "category": "发动机", "unit_price": 2850.0, "unit": "件", "lead_time_days": 21, "min_order_qty": 100, "supplier_code": "SUP-001"},
    {"part_number": "PRT-10002", "name": "ECU 电子控制单元", "category": "电子", "unit_price": 1200.0, "unit": "件", "lead_time_days": 30, "min_order_qty": 500, "supplier_code": "SUP-002"},
    {"part_number": "PRT-10003", "name": "空调压缩机", "category": "空调", "unit_price": 680.0, "unit": "件", "lead_time_days": 14, "min_order_qty": 200, "supplier_code": "SUP-003"},
    {"part_number": "PRT-10004", "name": "万向节总成", "category": "传动", "unit_price": 320.0, "unit": "件", "lead_time_days": 10, "min_order_qty": 300, "supplier_code": "SUP-004"},
    {"part_number": "PRT-10005", "name": "ABS 制动模块", "category": "制动", "unit_price": 950.0, "unit": "件", "lead_time_days": 18, "min_order_qty": 200, "supplier_code": "SUP-005"},
    {"part_number": "PRT-10006", "name": "自动变速箱阀体", "category": "变速箱", "unit_price": 4200.0, "unit": "件", "lead_time_days": 35, "min_order_qty": 50, "supplier_code": "SUP-006"},
    {"part_number": "PRT-10007", "name": "铝合金轮毂 18寸", "category": "底盘", "unit_price": 580.0, "unit": "件", "lead_time_days": 7, "min_order_qty": 400, "supplier_code": "SUP-007"},
    {"part_number": "PRT-10008", "name": "电动助力转向机", "category": "转向", "unit_price": 1580.0, "unit": "件", "lead_time_days": 25, "min_order_qty": 100, "supplier_code": "SUP-008"},
    {"part_number": "PRT-10009", "name": "涡轮增压器", "category": "发动机", "unit_price": 3500.0, "unit": "件", "lead_time_days": 28, "min_order_qty": 80, "supplier_code": "SUP-002"},
    {"part_number": "PRT-10010", "name": "缸体铸件", "category": "发动机", "unit_price": 1950.0, "unit": "件", "lead_time_days": 18, "min_order_qty": 150, "supplier_code": "SUP-001"},
    {"part_number": "PRT-10011", "name": "雷达传感器", "category": "电子", "unit_price": 860.0, "unit": "件", "lead_time_days": 20, "min_order_qty": 300, "supplier_code": "SUP-005"},
    {"part_number": "PRT-10012", "name": "散热器总成", "category": "散热", "unit_price": 420.0, "unit": "件", "lead_time_days": 12, "min_order_qty": 200, "supplier_code": "SUP-003"},
]

# ── 工厂 Plants ───────────────────────────────────────
plants = [
    {"plant_code": "PLT-SH", "name": "上海浦东工厂", "city": "上海", "country": "中国", "capacity_per_day": 800, "product_line": "SUV", "status": "运行中"},
    {"plant_code": "PLT-CQ", "name": "重庆两江工厂", "city": "重庆", "country": "中国", "capacity_per_day": 600, "product_line": "轿车", "status": "运行中"},
    {"plant_code": "PLT-CC", "name": "长春一汽工厂", "city": "长春", "country": "中国", "capacity_per_day": 1000, "product_line": "新能源", "status": "运行中"},
    {"plant_code": "PLT-GZ", "name": "广州南沙工厂", "city": "广州", "country": "中国", "capacity_per_day": 500, "product_line": "MPV", "status": "维护中"},
]

# ── 采购订单 Purchase Orders ──────────────────────────
statuses = ["已下单", "生产中", "已发货", "已到货", "已验收"]
po_list = []
base_date = datetime(2025, 1, 15)
for i in range(30):
    part = random.choice(parts)
    plant = random.choice(plants)
    qty = random.randint(1, 5) * part["min_order_qty"]
    order_date = base_date + timedelta(days=random.randint(0, 365))
    delivery_date = order_date + timedelta(days=part["lead_time_days"] + random.randint(-3, 7))
    status = random.choice(statuses)
    total_amount = round(qty * part["unit_price"], 2)
    po_list.append({
        "po_number": f"PO-2025-{1000+i}",
        "part_number": part["part_number"],
        "supplier_code": part["supplier_code"],
        "plant_code": plant["plant_code"],
        "quantity": qty,
        "unit_price": part["unit_price"],
        "total_amount": total_amount,
        "order_date": order_date.strftime("%Y-%m-%d"),
        "expected_delivery": delivery_date.strftime("%Y-%m-%d"),
        "status": status,
        "currency": "CNY",
    })

# ── 质量检测 Quality Inspections ─────────────────────
results_pool = ["合格", "合格", "合格", "合格", "轻微缺陷", "轻微缺陷", "不合格"]
inspections = []
for i, po in enumerate(po_list):
    if po["status"] in ("已到货", "已验收"):
        result = random.choice(results_pool)
        inspections.append({
            "inspection_id": f"QC-{2000+i}",
            "po_number": po["po_number"],
            "part_number": po["part_number"],
            "inspector": random.choice(["张工", "李工", "王工", "赵工"]),
            "inspection_date": po["expected_delivery"],
            "sample_size": random.choice([10, 20, 30, 50]),
            "defect_count": 0 if result == "合格" else random.randint(1, 5),
            "result": result,
            "notes": {
                "合格": "批次检验通过，参数指标均在公差范围内",
                "轻微缺陷": "存在外观瑕疵，不影响功能性能，降级使用",
                "不合格": "关键尺寸超差，整批退货处理",
            }[result],
        })


def write_csv(filename, rows):
    if not rows:
        return
    path = os.path.join(OUT, filename)
    with open(path, "w", newline="", encoding="utf-8") as f:
        w = csv.DictWriter(f, fieldnames=rows[0].keys())
        w.writeheader()
        w.writerows(rows)
    print(f"  {filename}: {len(rows)} rows")


print("Generating demo data...")
write_csv("suppliers.csv", suppliers)
write_csv("parts.csv", parts)
write_csv("plants.csv", plants)
write_csv("purchase_orders.csv", po_list)
write_csv("quality_inspections.csv", inspections)
print("Done!")
