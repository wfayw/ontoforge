#!/bin/bash
# OntoForge Demo — 供应链管理场景 自动化部署脚本
# 7 种实体类型 · 335+ 对象 · 8 种关联 · 6 种操作 · 2 个 Workshop 应用
set -e
BASE="http://localhost:8000/api/v1"
DIR="$(cd "$(dirname "$0")" && pwd)"

echo "============================================="
echo "  OntoForge 供应链管理演示 — 自动化部署"
echo "  (7 实体 · 335 对象 · 8 关联 · 6 操作)"
echo "============================================="

# ── 0. 注册用户并登录 ──────────────────────────────────
echo ""
echo ">>> 0. 注册用户并登录..."

curl -sf -X POST "$BASE/auth/register" \
  -H "Content-Type: application/json" \
  -d '{"username":"admin","email":"admin@ontoforge.io","password":"admin123"}' >/dev/null 2>&1 || true

curl -sf -X POST "$BASE/auth/register" \
  -H "Content-Type: application/json" \
  -d '{"username":"editor","email":"editor@ontoforge.io","password":"editor123"}' >/dev/null 2>&1 || true

curl -sf -X POST "$BASE/auth/register" \
  -H "Content-Type: application/json" \
  -d '{"username":"viewer","email":"viewer@ontoforge.io","password":"viewer123"}' >/dev/null 2>&1 || true

TOKEN=$(curl -sf -X POST "$BASE/auth/login" \
  -H "Content-Type: application/json" \
  -d '{"username":"admin","password":"admin123"}' | python3 -c "import sys,json;print(json.load(sys.stdin)['access_token'])")
AUTH="Authorization: Bearer $TOKEN"
echo "    admin Token: ${TOKEN:0:20}..."

EDITOR_UID=$(curl -sf "$BASE/auth/users" -H "$AUTH" | python3 -c "
import sys,json
for u in json.load(sys.stdin):
    if u['username']=='editor': print(u['id']); break
" 2>/dev/null || true)
if [ -n "$EDITOR_UID" ]; then
  curl -sf -X PATCH "$BASE/auth/users/$EDITOR_UID/role" \
    -H "$AUTH" -H "Content-Type: application/json" \
    -d '{"role":"editor"}' >/dev/null 2>&1 || true
fi
echo "    用户: admin(管理员) / editor(编辑者) / viewer(只读)"

# ── Helper ───────────────────────────────────────────
api() { curl -sf "$BASE/$1" -H "$AUTH" "${@:2}"; }
api_json() { curl -sf "$BASE/$1" -H "$AUTH" -H "Content-Type: application/json" "${@:2}"; }

# ── 1. 清除旧数据 ─────────────────────────────────────
echo ""
echo ">>> 1. 清除旧数据..."

# 分批删除所有对象实例 (处理大数据量)
PAGE=1
while true; do
  OBJS=$(api "instances/objects?page_size=200&page=$PAGE" | python3 -c "import sys,json;d=json.load(sys.stdin);[print(o['id']) for o in d['items']]" 2>/dev/null || true)
  [ -z "$OBJS" ] && break
  for oid in $OBJS; do
    api "instances/objects/$oid" -X DELETE >/dev/null 2>&1 || true
  done
  PAGE=$((PAGE + 1))
  [ "$PAGE" -gt 10 ] && break
done
echo "    对象实例已清除"

for res in "pipelines/" "data-sources/" "ontology/action-types" "ontology/link-types" "ontology/object-types" "workshop/apps" "aip/agents"; do
  IDS=$(api "$res" | python3 -c "import sys,json;d=json.load(sys.stdin);d=d if isinstance(d,list) else d.get('items',d);[print(i['id']) for i in (d if isinstance(d,list) else [])]" 2>/dev/null || true)
  for id in $IDS; do
    base_path=$(echo "$res" | sed 's|/$||')
    api "$base_path/$id" -X DELETE >/dev/null 2>&1 || true
  done
done
echo "    管道/数据源/操作/关联/类型/应用/智能体已清除"

# ── 2. 创建对象类型 (7 种) ──────────────────────────────
echo ""
echo ">>> 2. 创建本体对象类型 (7 种)..."

create_type() {
  local name=$1 display=$2 desc=$3 color=$4
  api_json "ontology/object-types" -X POST \
    -d "{\"name\":\"$name\",\"display_name\":\"$display\",\"description\":\"$desc\",\"color\":\"$color\",\"properties\":[]}" \
    | python3 -c "import sys,json;print(json.load(sys.stdin)['id'])"
}

add_prop() {
  local type_id=$1 name=$2 display=$3 dtype=$4 required=$5
  api_json "ontology/object-types/$type_id/properties" -X POST \
    -d "{\"name\":\"$name\",\"display_name\":\"$display\",\"data_type\":\"$dtype\",\"required\":$required,\"order\":0}" >/dev/null
}

# 供应商
SUP_ID=$(create_type "supplier" "供应商 Supplier" "零部件供应商 (20家/6国)" "#1890ff")
echo "    供应商: $SUP_ID"
add_prop "$SUP_ID" "supplier_code" "供应商编码" "string" true
add_prop "$SUP_ID" "country" "国家" "string" false
add_prop "$SUP_ID" "city" "城市" "string" false
add_prop "$SUP_ID" "contact_email" "联系邮箱" "string" false
add_prop "$SUP_ID" "rating" "评级" "string" false
add_prop "$SUP_ID" "established_year" "成立年份" "integer" false

# 零件
PART_ID=$(create_type "part" "零件 Part" "汽车零部件 (30种/10大类)" "#52c41a")
echo "    零件: $PART_ID"
add_prop "$PART_ID" "part_number" "零件编号" "string" true
add_prop "$PART_ID" "category" "分类" "string" false
add_prop "$PART_ID" "unit_price" "单价(CNY)" "float" false
add_prop "$PART_ID" "unit" "单位" "string" false
add_prop "$PART_ID" "lead_time_days" "交货周期(天)" "integer" false
add_prop "$PART_ID" "min_order_qty" "最小订购量" "integer" false
add_prop "$PART_ID" "supplier_code" "供应商编码" "string" false

# 工厂
PLANT_ID=$(create_type "plant" "工厂 Plant" "生产制造工厂 (8座/3国)" "#faad14")
echo "    工厂: $PLANT_ID"
add_prop "$PLANT_ID" "plant_code" "工厂编码" "string" true
add_prop "$PLANT_ID" "city" "城市" "string" false
add_prop "$PLANT_ID" "country" "国家" "string" false
add_prop "$PLANT_ID" "capacity_per_day" "日产能" "integer" false
add_prop "$PLANT_ID" "product_line" "产品线" "string" false
add_prop "$PLANT_ID" "status" "状态" "string" false

# 仓库 (新增)
WH_ID=$(create_type "warehouse" "仓库 Warehouse" "零部件仓储中心 (6座/3国)" "#13c2c2")
echo "    仓库: $WH_ID"
add_prop "$WH_ID" "warehouse_code" "仓库编码" "string" true
add_prop "$WH_ID" "city" "城市" "string" false
add_prop "$WH_ID" "country" "国家" "string" false
add_prop "$WH_ID" "capacity_sqm" "容量(㎡)" "integer" false
add_prop "$WH_ID" "status" "状态" "string" false

# 采购订单
PO_ID=$(create_type "purchase_order" "采购订单 PO" "零部件采购订单 (150笔/18月)" "#eb2f96")
echo "    采购订单: $PO_ID"
add_prop "$PO_ID" "po_number" "订单号" "string" true
add_prop "$PO_ID" "part_number" "零件编号" "string" false
add_prop "$PO_ID" "supplier_code" "供应商编码" "string" false
add_prop "$PO_ID" "plant_code" "工厂编码" "string" false
add_prop "$PO_ID" "quantity" "数量" "integer" false
add_prop "$PO_ID" "unit_price" "单价" "float" false
add_prop "$PO_ID" "total_amount" "总金额(CNY)" "float" false
add_prop "$PO_ID" "order_date" "下单日期" "string" false
add_prop "$PO_ID" "expected_delivery" "预计交货日" "string" false
add_prop "$PO_ID" "status" "状态" "string" false
add_prop "$PO_ID" "currency" "币种" "string" false

# 质量检测
QC_ID=$(create_type "quality_inspection" "质量检测 QC" "来料质量检测 (50批/4种结果)" "#722ed1")
echo "    质量检测: $QC_ID"
add_prop "$QC_ID" "inspection_id" "检测编号" "string" true
add_prop "$QC_ID" "po_number" "订单号" "string" false
add_prop "$QC_ID" "part_number" "零件编号" "string" false
add_prop "$QC_ID" "inspector" "检测员" "string" false
add_prop "$QC_ID" "inspection_date" "检测日期" "string" false
add_prop "$QC_ID" "sample_size" "抽样数量" "integer" false
add_prop "$QC_ID" "defect_count" "缺陷数" "integer" false
add_prop "$QC_ID" "result" "结果" "string" false
add_prop "$QC_ID" "notes" "备注" "string" false

# 物流记录 (新增)
DLV_ID=$(create_type "delivery" "物流记录 Delivery" "采购订单物流追踪 (71条)" "#fa541c")
echo "    物流记录: $DLV_ID"
add_prop "$DLV_ID" "delivery_id" "物流编号" "string" true
add_prop "$DLV_ID" "po_number" "订单号" "string" false
add_prop "$DLV_ID" "carrier" "承运商" "string" false
add_prop "$DLV_ID" "ship_date" "发货日期" "string" false
add_prop "$DLV_ID" "eta" "预计到达" "string" false
add_prop "$DLV_ID" "actual_arrival" "实际到达" "string" false
add_prop "$DLV_ID" "status" "状态" "string" false
add_prop "$DLV_ID" "tracking_number" "运单号" "string" false

# ── 3. 创建关联类型 (8 种) ─────────────────────────────
echo ""
echo ">>> 3. 创建关联类型 (8 种)..."

create_link() {
  local name=$1 display=$2 src=$3 tgt=$4 card=$5
  api_json "ontology/link-types" -X POST \
    -d "{\"name\":\"$name\",\"display_name\":\"$display\",\"source_type_id\":\"$src\",\"target_type_id\":\"$tgt\",\"cardinality\":\"$card\"}" >/dev/null
  echo "    $display ($card)"
}

create_link "supplier_provides_part" "供应零件" "$SUP_ID" "$PART_ID" "one_to_many"
create_link "part_ordered_in" "被采购" "$PART_ID" "$PO_ID" "one_to_many"
create_link "po_delivered_to_plant" "交付工厂" "$PO_ID" "$PLANT_ID" "many_to_many"
create_link "po_inspected_by" "质量检测" "$PO_ID" "$QC_ID" "one_to_many"
create_link "plant_has_warehouse" "工厂仓库" "$PLANT_ID" "$WH_ID" "one_to_many"
create_link "po_delivery" "物流追踪" "$PO_ID" "$DLV_ID" "one_to_many"
create_link "supplier_delivers_to_warehouse" "供货入仓" "$SUP_ID" "$WH_ID" "many_to_many"
create_link "warehouse_stores_part" "存储零件" "$WH_ID" "$PART_ID" "many_to_many"

# ── 4. 上传 CSV 数据源 ────────────────────────────────
echo ""
echo ">>> 4. 上传 CSV 数据源 (7 个)..."

upload_csv() {
  local file=$1
  curl -sf -X POST "$BASE/data-sources/upload-csv" \
    -H "$AUTH" -F "file=@$file" | python3 -c "import sys,json;print(json.load(sys.stdin)['id'])"
}

DS_SUP=$(upload_csv "$DIR/suppliers.csv");     echo "    suppliers.csv -> $DS_SUP"
DS_PART=$(upload_csv "$DIR/parts.csv");        echo "    parts.csv -> $DS_PART"
DS_PLANT=$(upload_csv "$DIR/plants.csv");      echo "    plants.csv -> $DS_PLANT"
DS_WH=$(upload_csv "$DIR/warehouses.csv");     echo "    warehouses.csv -> $DS_WH"
DS_PO=$(upload_csv "$DIR/purchase_orders.csv");echo "    purchase_orders.csv -> $DS_PO"
DS_QC=$(upload_csv "$DIR/quality_inspections.csv"); echo "    quality_inspections.csv -> $DS_QC"
DS_DLV=$(upload_csv "$DIR/deliveries.csv");    echo "    deliveries.csv -> $DS_DLV"

# ── 5. 创建管道并执行 ──────────────────────────────────
echo ""
echo ">>> 5. 创建管道并执行数据导入..."

create_and_run_pipeline() {
  local name=$1 src_id=$2 tgt_id=$3 mappings=$4
  local pl_id=$(api_json "pipelines/" -X POST \
    -d "{\"name\":\"$name\",\"source_id\":\"$src_id\",\"target_object_type_id\":\"$tgt_id\",\"field_mappings\":$mappings}" \
    | python3 -c "import sys,json;print(json.load(sys.stdin)['id'])")
  local result=$(api_json "pipelines/$pl_id/run" -X POST \
    | python3 -c "import sys,json;d=json.load(sys.stdin);print(f'{d[\"status\"]}: {d[\"rows_processed\"]} rows')")
  echo "    $name -> $result"
}

create_and_run_pipeline "导入供应商" "$DS_SUP" "$SUP_ID" \
  '{"name":"name","supplier_code":"supplier_code","country":"country","city":"city","contact_email":"contact_email","rating":"rating","established_year":"established_year"}'

create_and_run_pipeline "导入零件" "$DS_PART" "$PART_ID" \
  '{"name":"name","part_number":"part_number","category":"category","unit_price":"unit_price","unit":"unit","lead_time_days":"lead_time_days","min_order_qty":"min_order_qty","supplier_code":"supplier_code"}'

create_and_run_pipeline "导入工厂" "$DS_PLANT" "$PLANT_ID" \
  '{"name":"name","plant_code":"plant_code","city":"city","country":"country","capacity_per_day":"capacity_per_day","product_line":"product_line","status":"status"}'

create_and_run_pipeline "导入仓库" "$DS_WH" "$WH_ID" \
  '{"name":"name","warehouse_code":"warehouse_code","city":"city","country":"country","capacity_sqm":"capacity_sqm","status":"status"}'

create_and_run_pipeline "导入采购订单" "$DS_PO" "$PO_ID" \
  '{"po_number":"po_number","part_number":"part_number","supplier_code":"supplier_code","plant_code":"plant_code","quantity":"quantity","unit_price":"unit_price","total_amount":"total_amount","order_date":"order_date","expected_delivery":"expected_delivery","status":"status","currency":"currency"}'

create_and_run_pipeline "导入质量检测" "$DS_QC" "$QC_ID" \
  '{"inspection_id":"inspection_id","po_number":"po_number","part_number":"part_number","inspector":"inspector","inspection_date":"inspection_date","sample_size":"sample_size","defect_count":"defect_count","result":"result","notes":"notes"}'

create_and_run_pipeline "导入物流记录" "$DS_DLV" "$DLV_ID" \
  '{"delivery_id":"delivery_id","po_number":"po_number","carrier":"carrier","ship_date":"ship_date","eta":"eta","actual_arrival":"actual_arrival","status":"status","tracking_number":"tracking_number"}'

# ── 6. 创建操作类型 (6 种) ────────────────────────────
echo ""
echo ">>> 6. 创建操作类型 (6 种)..."

api_json "ontology/action-types" -X POST -d "{
  \"name\": \"approve_po\",
  \"display_name\": \"审批采购订单\",
  \"description\": \"将采购订单状态变更为已审批，进入生产准备流程\",
  \"object_type_id\": \"$PO_ID\",
  \"parameters\": {\"parameters\": [{\"name\": \"target_id\", \"type\": \"string\", \"required\": true}]},
  \"logic_type\": \"edit_object\",
  \"logic_config\": {\"target\": \"{{target_id}}\", \"updates\": {\"status\": \"已审批\"}}
}" >/dev/null
echo "    审批采购订单 (approve_po)"

api_json "ontology/action-types" -X POST -d "{
  \"name\": \"reject_po\",
  \"display_name\": \"驳回采购订单\",
  \"description\": \"将采购订单状态变更为已驳回\",
  \"object_type_id\": \"$PO_ID\",
  \"parameters\": {\"parameters\": [{\"name\": \"target_id\", \"type\": \"string\", \"required\": true}, {\"name\": \"reason\", \"type\": \"string\", \"required\": false}]},
  \"logic_type\": \"edit_object\",
  \"logic_config\": {\"target\": \"{{target_id}}\", \"updates\": {\"status\": \"已驳回\"}}
}" >/dev/null
echo "    驳回采购订单 (reject_po)"

api_json "ontology/action-types" -X POST -d "{
  \"name\": \"mark_delivered\",
  \"display_name\": \"确认到货\",
  \"description\": \"将采购订单状态变更为已到货，触发质检流程\",
  \"object_type_id\": \"$PO_ID\",
  \"parameters\": {\"parameters\": [{\"name\": \"target_id\", \"type\": \"string\", \"required\": true}]},
  \"logic_type\": \"edit_object\",
  \"logic_config\": {\"target\": \"{{target_id}}\", \"updates\": {\"status\": \"已到货\"}}
}" >/dev/null
echo "    确认到货 (mark_delivered)"

api_json "ontology/action-types" -X POST -d "{
  \"name\": \"flag_quality_issue\",
  \"display_name\": \"标记质量问题\",
  \"description\": \"将质量检测结果标记为不合格，触发退货流程\",
  \"object_type_id\": \"$QC_ID\",
  \"parameters\": {\"parameters\": [{\"name\": \"target_id\", \"type\": \"string\", \"required\": true}]},
  \"logic_type\": \"edit_object\",
  \"logic_config\": {\"target\": \"{{target_id}}\", \"updates\": {\"result\": \"不合格\"}}
}" >/dev/null
echo "    标记质量问题 (flag_quality_issue)"

api_json "ontology/action-types" -X POST -d "{
  \"name\": \"mark_delivery_arrived\",
  \"display_name\": \"确认物流到达\",
  \"description\": \"将物流记录状态变更为已到达\",
  \"object_type_id\": \"$DLV_ID\",
  \"parameters\": {\"parameters\": [{\"name\": \"target_id\", \"type\": \"string\", \"required\": true}]},
  \"logic_type\": \"edit_object\",
  \"logic_config\": {\"target\": \"{{target_id}}\", \"updates\": {\"status\": \"已到达\"}}
}" >/dev/null
echo "    确认物流到达 (mark_delivery_arrived)"

api_json "ontology/action-types" -X POST -d "{
  \"name\": \"flag_delivery_delay\",
  \"display_name\": \"标记物流延迟\",
  \"description\": \"将物流记录状态标记为异常（延迟）\",
  \"object_type_id\": \"$DLV_ID\",
  \"parameters\": {\"parameters\": [{\"name\": \"target_id\", \"type\": \"string\", \"required\": true}]},
  \"logic_type\": \"edit_object\",
  \"logic_config\": {\"target\": \"{{target_id}}\", \"updates\": {\"status\": \"异常\"}}
}" >/dev/null
echo "    标记物流延迟 (flag_delivery_delay)"

# ── 7. 创建关联实例 ────────────────────────────────────
echo ""
echo ">>> 7. 创建关联实例 — 构建对象图谱..."

# 获取 link type IDs
get_lt() { api "ontology/link-types" | python3 -c "import sys,json;[print(t['id']) for t in json.load(sys.stdin) if t['name']=='$1']" | head -1; }
LT_SUP_PART=$(get_lt supplier_provides_part)
LT_PART_PO=$(get_lt part_ordered_in)
LT_PO_PLANT=$(get_lt po_delivered_to_plant)
LT_PO_QC=$(get_lt po_inspected_by)
LT_PLANT_WH=$(get_lt plant_has_warehouse)
LT_PO_DLV=$(get_lt po_delivery)
LT_SUP_WH=$(get_lt supplier_delivers_to_warehouse)
LT_WH_PART=$(get_lt warehouse_stores_part)

python3 -c "
import json, subprocess, sys

def api_get(path):
    r = subprocess.run(['curl', '-sf', '$BASE/' + path, '-H', '$AUTH'], capture_output=True, text=True)
    return json.loads(r.stdout)

all_objs = api_get('instances/objects?page_size=500')['items']

def by_prop(type_id, prop):
    return {o['properties'].get(prop): o['id'] for o in all_objs if o['object_type_id'] == type_id}

sup_by_code = by_prop('$SUP_ID', 'supplier_code')
part_by_num = by_prop('$PART_ID', 'part_number')
plant_by_code = by_prop('$PLANT_ID', 'plant_code')
wh_by_code = by_prop('$WH_ID', 'warehouse_code')
po_by_num = by_prop('$PO_ID', 'po_number')
qc_by_id = by_prop('$QC_ID', 'inspection_id')
dlv_by_id = by_prop('$DLV_ID', 'delivery_id')

links = set()

# supplier -> part
for o in all_objs:
    if o['object_type_id'] == '$PART_ID':
        sc = o['properties'].get('supplier_code')
        if sc and sc in sup_by_code:
            links.add(('$LT_SUP_PART', sup_by_code[sc], o['id']))

# part -> po
for o in all_objs:
    if o['object_type_id'] == '$PO_ID':
        pn = o['properties'].get('part_number')
        if pn and pn in part_by_num:
            links.add(('$LT_PART_PO', part_by_num[pn], o['id']))

# po -> plant
for o in all_objs:
    if o['object_type_id'] == '$PO_ID':
        pc = o['properties'].get('plant_code')
        if pc and pc in plant_by_code:
            links.add(('$LT_PO_PLANT', o['id'], plant_by_code[pc]))

# po -> qc
for o in all_objs:
    if o['object_type_id'] == '$QC_ID':
        pn = o['properties'].get('po_number')
        if pn and pn in po_by_num:
            links.add(('$LT_PO_QC', po_by_num[pn], o['id']))

# po -> delivery
for o in all_objs:
    if o['object_type_id'] == '$DLV_ID':
        pn = o['properties'].get('po_number')
        if pn and pn in po_by_num:
            links.add(('$LT_PO_DLV', po_by_num[pn], o['id']))

# plant -> warehouse (mapping by city prefix)
plant_wh_map = {
    'PLT-SH': 'WH-SH01', 'PLT-CQ': 'WH-CQ01', 'PLT-CC': 'WH-CC01',
    'PLT-GZ': 'WH-GZ01', 'PLT-CD': 'WH-SH01', 'PLT-WH': 'WH-CQ01',
    'PLT-TH': 'WH-TH01', 'PLT-DE': 'WH-DE01',
}
for pc, wc in plant_wh_map.items():
    if pc in plant_by_code and wc in wh_by_code:
        links.add(('$LT_PLANT_WH', plant_by_code[pc], wh_by_code[wc]))

# supplier -> warehouse (Chinese suppliers -> Chinese warehouses, etc.)
cn_whs = ['WH-SH01', 'WH-CQ01', 'WH-CC01', 'WH-GZ01']
for o in all_objs:
    if o['object_type_id'] == '$SUP_ID':
        sc = o['properties'].get('supplier_code')
        country = o['properties'].get('country', '')
        if sc:
            if country == '中国':
                for wc in cn_whs[:2]:
                    if wc in wh_by_code: links.add(('$LT_SUP_WH', o['id'], wh_by_code[wc]))
            elif country in ('德国', '法国', '瑞典', '爱尔兰'):
                if 'WH-DE01' in wh_by_code: links.add(('$LT_SUP_WH', o['id'], wh_by_code['WH-DE01']))
            elif country == '泰国':
                if 'WH-TH01' in wh_by_code: links.add(('$LT_SUP_WH', o['id'], wh_by_code['WH-TH01']))
            else:
                if 'WH-SH01' in wh_by_code: links.add(('$LT_SUP_WH', o['id'], wh_by_code['WH-SH01']))

# warehouse -> part (parts stored in warehouses near their plants)
for o in all_objs:
    if o['object_type_id'] == '$PART_ID':
        sc = o['properties'].get('supplier_code')
        if sc:
            sup_obj = [s for s in all_objs if s['object_type_id']=='$SUP_ID' and s['properties'].get('supplier_code')==sc]
            if sup_obj:
                country = sup_obj[0]['properties'].get('country','')
                if country == '中国':
                    for wc in cn_whs[:2]:
                        if wc in wh_by_code: links.add(('$LT_WH_PART', wh_by_code[wc], o['id']))
                elif country in ('德国','法国','瑞典','爱尔兰'):
                    if 'WH-DE01' in wh_by_code: links.add(('$LT_WH_PART', wh_by_code['WH-DE01'], o['id']))

for lt, src, tgt in links:
    print(json.dumps({'link_type_id': lt, 'source_id': src, 'target_id': tgt}))
" | while IFS= read -r line; do
  api_json "instances/links" -X POST -d "$line" >/dev/null 2>&1 || true
done

LINK_COUNT=$(api "instances/links" | python3 -c "import sys,json;print(len(json.load(sys.stdin)))")
echo "    创建了 $LINK_COUNT 条关联实例"

# ── 8. 创建 AI 智能体 ─────────────────────────────────
echo ""
echo ">>> 8. 创建 AI 智能体..."

PROVIDER_ID=$(api "aip/providers" | python3 -c "import sys,json;d=json.load(sys.stdin);print(d[0]['id'] if d else '')" 2>/dev/null || true)
PROVIDER_FIELD=""
if [ -n "$PROVIDER_ID" ]; then
  PROVIDER_FIELD="\"llm_provider_id\": \"$PROVIDER_ID\","
fi

api_json "aip/agents" -X POST -d "{
  \"name\": \"供应链分析师\",
  \"description\": \"全功能供应链AI助手 — 查询分析、操作执行、图谱探索、文档检索\",
  \"system_prompt\": \"你是OntoForge供应链管理AI助手。本系统管理20家供应商(6国)、30种零件(10大类)、8座工厂(3国)、6个仓库、150笔采购订单(18个月)、50条质检记录和71条物流记录。你可以：查询本体数据、执行操作(审批/驳回订单、确认到货/物流)、做聚合分析(按供应商/状态/月份/零件类别)、创建修改对象、搜索文档知识库。已知风险：SUP-015(泰源精密)评级C级且质量恶化中，广州工厂维护中。请用中文回答，简洁专业。\",
  $PROVIDER_FIELD
  \"temperature\": 0.3,
  \"tools\": [\"ontology_query\", \"action_execute\", \"analytics\", \"instance_write\", \"document_search\"],
  \"status\": \"active\"
}" >/dev/null
echo "    供应链分析师 — 已创建"

# ── 9. 创建告警规则 (3 条) ──────────────────────────────
echo ""
echo ">>> 9. 创建告警规则 (3 条)..."

api_json "alerts/rules" -X POST -d "{
  \"name\": \"质检缺陷严重\",
  \"description\": \"缺陷数>=3 触发 critical 告警\",
  \"object_type_id\": \"$QC_ID\",
  \"condition\": {\"field\": \"defect_count\", \"operator\": \">=\", \"value\": 3},
  \"severity\": \"critical\"
}" >/dev/null
echo "    规则1: 质检缺陷>=3 → critical"

api_json "alerts/rules" -X POST -d "{
  \"name\": \"质检轻微缺陷\",
  \"description\": \"缺陷数>=1 触发 warning 告警\",
  \"object_type_id\": \"$QC_ID\",
  \"condition\": {\"field\": \"defect_count\", \"operator\": \">=\", \"value\": 1},
  \"severity\": \"warning\"
}" >/dev/null
echo "    规则2: 质检缺陷>=1 → warning"

api_json "alerts/rules" -X POST -d "{
  \"name\": \"高金额采购订单\",
  \"description\": \"总金额>=500万触发 info 告警\",
  \"object_type_id\": \"$PO_ID\",
  \"condition\": {\"field\": \"total_amount\", \"operator\": \">=\", \"value\": 5000000},
  \"severity\": \"info\"
}" >/dev/null
echo "    规则3: 采购金额>=500万 → info"

# ── 10. 创建 Workshop 应用 (2 个) ──────────────────────
echo ""
echo ">>> 10. 创建 Workshop 应用..."

# === 应用1: 供应链监控大屏 ===
WS_APP_ID=$(api_json "workshop/apps" -X POST \
  -d '{"name":"供应链监控大屏","description":"实时监控供应商、采购订单、质量检测和物流关键指标","icon":"DashboardOutlined"}' \
  | python3 -c "import sys,json;print(json.load(sys.stdin)['id'])")
echo "    应用1: 供应链监控大屏 ($WS_APP_ID)"

# Widget 1-3: StatCards
api_json "workshop/apps/$WS_APP_ID/widgets" -X POST -d "{
  \"widget_type\": \"stat_card\", \"title\": \"供应商总数\",
  \"position\": {\"x\": 0, \"y\": 0, \"w\": 3, \"h\": 3},
  \"data_binding\": {\"object_type_id\": \"$SUP_ID\", \"metric\": \"count\"}, \"order\": 0
}" >/dev/null

api_json "workshop/apps/$WS_APP_ID/widgets" -X POST -d "{
  \"widget_type\": \"stat_card\", \"title\": \"采购订单总额(CNY)\",
  \"position\": {\"x\": 3, \"y\": 0, \"w\": 3, \"h\": 3},
  \"data_binding\": {\"object_type_id\": \"$PO_ID\", \"metric\": \"sum\", \"property_name\": \"total_amount\"}, \"order\": 1
}" >/dev/null

api_json "workshop/apps/$WS_APP_ID/widgets" -X POST -d "{
  \"widget_type\": \"stat_card\", \"title\": \"质检批次数\",
  \"position\": {\"x\": 6, \"y\": 0, \"w\": 3, \"h\": 3},
  \"data_binding\": {\"object_type_id\": \"$QC_ID\", \"metric\": \"count\"}, \"order\": 2
}" >/dev/null

api_json "workshop/apps/$WS_APP_ID/widgets" -X POST -d "{
  \"widget_type\": \"stat_card\", \"title\": \"物流记录数\",
  \"position\": {\"x\": 9, \"y\": 0, \"w\": 3, \"h\": 3},
  \"data_binding\": {\"object_type_id\": \"$DLV_ID\", \"metric\": \"count\"}, \"order\": 3
}" >/dev/null
echo "    Widget 1-4: StatCard (供应商/订单额/质检/物流)"

# Widget 5: Chart — 采购订单状态分布
api_json "workshop/apps/$WS_APP_ID/widgets" -X POST -d "{
  \"widget_type\": \"chart\", \"title\": \"采购订单状态分布\",
  \"config\": {\"chart_type\": \"pie\"},
  \"position\": {\"x\": 0, \"y\": 3, \"w\": 6, \"h\": 5},
  \"data_binding\": {\"object_type_id\": \"$PO_ID\", \"metric\": \"count\", \"group_by\": \"status\"}, \"order\": 4
}" >/dev/null
echo "    Widget 5: Chart — 订单状态分布(饼图)"

# Widget 6: Chart — 按供应商采购金额 TOP
api_json "workshop/apps/$WS_APP_ID/widgets" -X POST -d "{
  \"widget_type\": \"chart\", \"title\": \"供应商采购金额 TOP\",
  \"config\": {\"chart_type\": \"bar\"},
  \"position\": {\"x\": 6, \"y\": 3, \"w\": 6, \"h\": 5},
  \"data_binding\": {\"object_type_id\": \"$PO_ID\", \"metric\": \"sum\", \"property_name\": \"total_amount\", \"group_by\": \"supplier_code\"}, \"order\": 5
}" >/dev/null
echo "    Widget 6: Chart — 供应商采购金额(柱图)"

# Widget 7: Table — 质量检测记录
api_json "workshop/apps/$WS_APP_ID/widgets" -X POST -d "{
  \"widget_type\": \"table\", \"title\": \"质量检测记录\",
  \"position\": {\"x\": 0, \"y\": 8, \"w\": 6, \"h\": 5},
  \"data_binding\": {\"object_type_id\": \"$QC_ID\"}, \"order\": 6
}" >/dev/null
echo "    Widget 7: Table — 质量检测"

# Widget 8: Table — 物流追踪
api_json "workshop/apps/$WS_APP_ID/widgets" -X POST -d "{
  \"widget_type\": \"table\", \"title\": \"物流追踪\",
  \"position\": {\"x\": 6, \"y\": 8, \"w\": 6, \"h\": 5},
  \"data_binding\": {\"object_type_id\": \"$DLV_ID\"}, \"order\": 7
}" >/dev/null
echo "    Widget 8: Table — 物流追踪"

# Widget 9: ActionButton — 审批采购订单
APPROVE_AT_ID=$(api "ontology/action-types" | python3 -c "import sys,json;[print(a['id']) for a in json.load(sys.stdin) if a['name']=='approve_po']" | head -1)
api_json "workshop/apps/$WS_APP_ID/widgets" -X POST -d "{
  \"widget_type\": \"action_button\", \"title\": \"审批采购订单\",
  \"position\": {\"x\": 0, \"y\": 13, \"w\": 4, \"h\": 2},
  \"data_binding\": {\"action_type_id\": \"$APPROVE_AT_ID\"}, \"order\": 8
}" >/dev/null
echo "    Widget 9: ActionButton — 审批"

# Widget 10-13: Phase 5 高级 Widget
api_json "workshop/apps/$WS_APP_ID/widgets" -X POST -d "{
  \"widget_type\": \"filter\", \"title\": \"供应商筛选\",
  \"position\": {\"x\": 4, \"y\": 13, \"w\": 4, \"h\": 2},
  \"data_binding\": {\"object_type_id\": \"$PO_ID\", \"field\": \"supplier_code\"},
  \"config\": {\"variable\": \"supplier_filter\"}, \"order\": 9
}" >/dev/null
echo "    Widget 10: Filter — 供应商筛选"

api_json "workshop/apps/$WS_APP_ID/widgets" -X POST -d "{
  \"widget_type\": \"object_list\", \"title\": \"供应商列表\",
  \"position\": {\"x\": 0, \"y\": 15, \"w\": 4, \"h\": 5},
  \"data_binding\": {\"object_type_id\": \"$SUP_ID\", \"page_size\": 20, \"display_properties\": [\"supplier_code\", \"country\", \"rating\"], \"filters\": {\"supplier_code\": \"{{supplier_filter}}\"}}, \"order\": 10
}" >/dev/null
echo "    Widget 11: ObjectList — 供应商卡片"

api_json "workshop/apps/$WS_APP_ID/widgets" -X POST -d "{
  \"widget_type\": \"alert_list\", \"title\": \"质量告警\",
  \"position\": {\"x\": 4, \"y\": 15, \"w\": 4, \"h\": 5},
  \"data_binding\": {\"page_size\": 10}, \"order\": 11
}" >/dev/null
echo "    Widget 12: AlertList — 质量告警"

AGENT_ID=$(api "aip/agents" | python3 -c "import sys,json;agents=json.load(sys.stdin);print(agents[0]['id'] if agents else '')" 2>/dev/null || true)
if [ -n "$AGENT_ID" ]; then
  api_json "workshop/apps/$WS_APP_ID/widgets" -X POST -d "{
    \"widget_type\": \"agent_chat\", \"title\": \"AI 供应链助手\",
    \"position\": {\"x\": 8, \"y\": 13, \"w\": 4, \"h\": 7},
    \"data_binding\": {\"agent_id\": \"$AGENT_ID\"}, \"order\": 12
  }" >/dev/null
  echo "    Widget 13: AgentChat — AI助手"
fi

api_json "workshop/apps/$WS_APP_ID" -X PATCH -d '{
  "variables": {"supplier_filter": {"type": "string", "default": ""}}
}' >/dev/null
api_json "workshop/apps/$WS_APP_ID/publish" -X POST >/dev/null
echo "    应用1 已发布 ✓"

# === 应用2: 物流追踪看板 ===
WS_APP2_ID=$(api_json "workshop/apps" -X POST \
  -d '{"name":"物流追踪看板","description":"实时追踪采购订单物流状态与延迟告警","icon":"CarOutlined"}' \
  | python3 -c "import sys,json;print(json.load(sys.stdin)['id'])")
echo "    应用2: 物流追踪看板 ($WS_APP2_ID)"

api_json "workshop/apps/$WS_APP2_ID/widgets" -X POST -d "{
  \"widget_type\": \"stat_card\", \"title\": \"物流总数\",
  \"position\": {\"x\": 0, \"y\": 0, \"w\": 4, \"h\": 3},
  \"data_binding\": {\"object_type_id\": \"$DLV_ID\", \"metric\": \"count\"}, \"order\": 0
}" >/dev/null

api_json "workshop/apps/$WS_APP2_ID/widgets" -X POST -d "{
  \"widget_type\": \"chart\", \"title\": \"物流状态分布\",
  \"config\": {\"chart_type\": \"pie\"},
  \"position\": {\"x\": 4, \"y\": 0, \"w\": 4, \"h\": 5},
  \"data_binding\": {\"object_type_id\": \"$DLV_ID\", \"metric\": \"count\", \"group_by\": \"status\"}, \"order\": 1
}" >/dev/null

api_json "workshop/apps/$WS_APP2_ID/widgets" -X POST -d "{
  \"widget_type\": \"chart\", \"title\": \"承运商订单量\",
  \"config\": {\"chart_type\": \"bar\"},
  \"position\": {\"x\": 8, \"y\": 0, \"w\": 4, \"h\": 5},
  \"data_binding\": {\"object_type_id\": \"$DLV_ID\", \"metric\": \"count\", \"group_by\": \"carrier\"}, \"order\": 2
}" >/dev/null

api_json "workshop/apps/$WS_APP2_ID/widgets" -X POST -d "{
  \"widget_type\": \"table\", \"title\": \"物流记录明细\",
  \"position\": {\"x\": 0, \"y\": 5, \"w\": 12, \"h\": 6},
  \"data_binding\": {\"object_type_id\": \"$DLV_ID\"}, \"order\": 3
}" >/dev/null

api_json "workshop/apps/$WS_APP2_ID/publish" -X POST >/dev/null
echo "    应用2 已发布 ✓"

# ── 11. 上传文档知识库 ─────────────────────────────────
echo ""
echo ">>> 11. 上传文档知识库..."

DOC_IDS=$(api "documents/" | python3 -c "import sys,json;[print(d['id']) for d in json.load(sys.stdin)]" 2>/dev/null || true)
for did in $DOC_IDS; do
  api "documents/$did" -X DELETE >/dev/null 2>&1 || true
done

api_json "documents/" -X POST -d '{
  "name": "供应链管理手册 V2.0",
  "description": "汽车零部件供应链管理标准操作流程 — 覆盖采购、质量、物流、风控",
  "content": "第一章 供应商管理\n\n1.1 供应商准入标准\n新供应商需满足以下条件：ISO 9001 / IATF 16949 认证、年产能不低于10万件、交货准时率>95%、质量合格率>98%。供应商评级分为 A（优秀，份额可增至40%）、B（良好，份额20-30%）、C（观察期，限制份额<10%）三级。C级供应商连续两季度未达标将被取消资格。\n\n1.2 供应商绩效评估\n每季度评估维度：交货准时率（权重30%）、质量合格率（权重35%）、价格竞争力（权重20%）、技术响应速度（权重15%）。评分 = Σ(维度分×权重)。评级结果直接影响下一季度订单分配比例。\n\n1.3 供应商风险管理\n高风险预警信号：交货延迟率>15%、质检不合格率>5%、财务评级下调、自然灾害影响产区。发现预警信号后48小时内启动应急评估，72小时内出具替代方案。\n\n第二章 采购订单管理\n\n2.1 采购审批流程\n需求确认 → 供应商选择(评级优先) → 价格谈判(不超过基准价110%) → 订单创建 → 三级审批 → 订单发出 → 到货验收 → 质量检测 → 入库。审批规则：<50万部门经理审批，50-200万总监审批，>200万副总裁审批。\n\n2.2 订单状态机\n已下单 → 已审批 → 生产中 → 已发货 → 已到货 → 已验收。异常状态：延迟（超期5天）、已驳回（审批不通过）。延迟超过10天自动升级至供应链总监。\n\n2.3 紧急采购\n库存低于安全线或产线停工风险时触发紧急采购。紧急采购允许跳过部分审批环节，但需72小时内补齐审批手续。紧急采购成本上限为基准价的130%。\n\n第三章 质量管控\n\n3.1 来料检测标准 (IQC)\n所有来料必须抽检，抽检比例：A级供应商3%、B级供应商5%、C级供应商10%。检测项目：外观检查、尺寸测量（CMM三坐标）、材料成分分析（光谱仪）、功能测试。缺陷数≥3件/批判定为不合格。轻微缺陷可降级使用但需记录。\n\n3.2 质量追溯\n发现质量问题时，通过本体图谱追溯完整链路：质检记录 → 采购订单 → 零件 → 供应商。24小时内完成根因分析，48小时内出具8D报告。同一供应商同类问题连续发生3次，启动供应商降级评审。\n\n第四章 物流管理\n\n4.1 物流追踪\n所有采购订单必须配套物流追踪单。国内订单使用顺丰/德邦/京东物流，国际订单使用马士基/DHL/FedEx/DB Schenker。物流状态：已发出 → 运输中 → 清关中(国际) → 已到达。\n\n4.2 物流异常处理\n预计到达时间(ETA)超期3天标记为预警，超期5天标记为异常。异常物流自动通知采购经理和物流协调员，同时触发备选方案评估。\n\n4.3 仓储管理\n6个仓库分布在中国(4个)、德国(1个)、泰国(1个)。仓库容量使用率超过85%触发扩容预警。零件存储遵循FIFO原则，保质期零件需标注有效期。"
}' >/dev/null
echo "    文档1: 供应链管理手册 V2.0"

api_json "documents/" -X POST -d '{
  "name": "设备维修指南",
  "description": "工厂设备日常维护和故障排除手册",
  "content": "第一章 设备分类与维护周期\n\n1.1 关键设备分类\nA类设备（核心产线）：CNC加工中心、冲压机、注塑机、焊接机器人。维护周期：每日点检、每周保养、每月深度维护。\nB类设备（辅助设备）：输送带、包装机、检测仪器、AGV。维护周期：每周点检、每月保养。\n\n1.2 预防性维护\nCNC加工中心：每2000小时更换主轴轴承，每500小时更换切削液，每100小时检查导轨润滑。冲压机：每1000小时检查模具磨损，每200小时检查液压系统。焊接机器人：每500小时校准焊枪位置，每1000小时更换送丝机构。\n\n第二章 常见故障排除\n\n2.1 CNC加工中心\n故障码E001：主轴过热→检查冷却系统→清洁散热片→检查冷却液液位。\n故障码E002：伺服轴报警→检查编码器连接→确认伺服参数。\n故障码E003：刀具破损→更换刀具→重新对刀→检查切削参数。\n\n2.2 冲压机\n故障码P001：液压压力不足→检查液压油量→检查滤芯→确认溢流阀设定。\n故障码P002：送料不准确→检查定位传感器→校准步进量。\n\n2.3 焊接机器人\n故障码W001：焊接飞溅过大→检查气体流量→调整电流参数→清洁喷嘴。\n故障码W002：焊缝偏移→重新示教路径→检查工件定位夹具。"
}' >/dev/null
echo "    文档2: 设备维修指南"

api_json "documents/" -X POST -d '{
  "name": "供应商风险评估报告 2025-Q4",
  "description": "2025年第四季度供应商风险评估及应对建议",
  "content": "供应商风险评估报告 — 2025年第四季度\n\n一、评估概要\n本季度对20家核心供应商进行了全面风险评估，覆盖6个国家。整体风险水平较Q3略有上升，主要受地缘政治和原材料价格波动影响。\n\n二、高风险供应商\n\n2.1 SUP-015 泰源精密制造（东莞）— 评级 C\n风险等级：高\n问题描述：\n- 交货准时率：78%（行业基准95%）\n- 质检不合格率：18%（标准<5%）\n- 近3个月缺陷数呈上升趋势（月均缺陷从3件升至8件）\n- 主要问题零件：PRT-10025（铸铝副车架）和PRT-10030（冲压A柱加强板）\n建议措施：\n1. 立即降低订单份额至当前的50%\n2. 启动备选供应商评估（推荐SUP-007中信戴卡）\n3. 增加来料检测抽检比例至15%\n4. 限期3个月改善，未达标则取消合格供应商资格\n\n2.2 SUP-006 Aisin Seiki（日本）— 评级 B\n风险等级：中\n问题描述：\n- 自动变速箱阀体(PRT-10006)交货周期从35天延长至42天\n- 日元汇率波动导致成本上升约8%\n建议措施：\n1. 协商锁定汇率条款\n2. 适度增加安全库存\n\n三、行业风险\n\n3.1 新能源零部件供应紧张\n锂电池(PRT-10013)和电驱动总成(PRT-10014)全球产能紧张，交货周期延长20%。建议与SUP-011(宁德时代)签订长期供应协议。\n\n3.2 欧洲物流成本上升\n经Hamburg中转仓(WH-DE01)的物流成本较去年同期上升15%。建议评估直送模式可行性。\n\n四、下季度行动计划\n1. 完成SUP-015替代方案（1月底前）\n2. 与SUP-011签订2026年电池供应框架协议\n3. 优化欧洲物流路线\n4. 新增韩国SUP-009 Hyundai Mobis的EPS电子助力泵供应评估"
}' >/dev/null
echo "    文档3: 供应商风险评估报告 2025-Q4"

# ── 12. 验证数据 ──────────────────────────────────────
echo ""
echo "============================================="
echo "  数据验证"
echo "============================================="

echo ""
api "ontology/object-types" | python3 -c "
import sys,json
types = json.load(sys.stdin)
print(f'本体对象类型: {len(types)} 种')
for t in types:
    print(f'  [{t[\"color\"]}] {t[\"display_name\"]} — {len(t[\"properties\"])} 属性')
"

echo ""
api "instances/objects?page_size=1" | python3 -c "
import sys,json; print(f'对象实例总数: {json.load(sys.stdin)[\"total\"]}')
"

echo ""
api "instances/links" | python3 -c "
import sys,json; print(f'关联实例总数: {len(json.load(sys.stdin))}')
"

echo ""
echo "操作类型:"
api "ontology/action-types" | python3 -c "
import sys,json
for a in json.load(sys.stdin):
    print(f'  ⚡ {a[\"display_name\"]} ({a[\"name\"]})')
"

echo ""
echo "告警规则:"
api "alerts/rules" | python3 -c "
import sys,json
for r in json.load(sys.stdin):
    print(f'  🔔 {r[\"name\"]} ({r[\"severity\"]})')
"

echo ""
echo "聚合分析 — 按状态统计采购订单:"
api_json "instances/objects/aggregate" -X POST \
  -d "{\"object_type_id\":\"$PO_ID\",\"metric\":\"count\",\"group_by\":\"status\"}" \
  | python3 -c "
import sys,json
data = json.load(sys.stdin)
total = sum(r['value'] for r in data.get('results', []))
for r in sorted(data.get('results', []), key=lambda x: x['value'], reverse=True):
    pct = round(r['value'] / total * 100) if total else 0
    print(f'  {r[\"key\"]}: {r[\"value\"]} 单 ({pct}%)')
print(f'  合计: {total} 单')
"

echo ""
echo "聚合分析 — 按供应商采购金额 TOP5:"
api_json "instances/objects/aggregate" -X POST \
  -d "{\"object_type_id\":\"$PO_ID\",\"metric\":\"sum\",\"property_name\":\"total_amount\",\"group_by\":\"supplier_code\"}" \
  | python3 -c "
import sys,json
data = json.load(sys.stdin)
results = sorted(data.get('results', []), key=lambda x: x['value'], reverse=True)[:5]
for r in results:
    print(f'  {r[\"key\"]}: ¥{r[\"value\"]:,.0f}')
"

echo ""
echo "聚合分析 — 质检结果分布:"
api_json "instances/objects/aggregate" -X POST \
  -d "{\"object_type_id\":\"$QC_ID\",\"metric\":\"count\",\"group_by\":\"result\"}" \
  | python3 -c "
import sys,json
for r in json.load(sys.stdin).get('results', []):
    print(f'  {r[\"key\"]}: {r[\"value\"]} 批次')
"

echo ""
echo "聚合分析 — 物流状态分布:"
api_json "instances/objects/aggregate" -X POST \
  -d "{\"object_type_id\":\"$DLV_ID\",\"metric\":\"count\",\"group_by\":\"status\"}" \
  | python3 -c "
import sys,json
for r in json.load(sys.stdin).get('results', []):
    print(f'  {r[\"key\"]}: {r[\"value\"]} 条')
"

# RBAC 验证
echo ""
echo "--- RBAC 验证 ---"
VIEWER_TOKEN=$(curl -sf -X POST "$BASE/auth/login" \
  -H "Content-Type: application/json" \
  -d '{"username":"viewer","password":"viewer123"}' | python3 -c "import sys,json;print(json.load(sys.stdin)['access_token'])" 2>/dev/null || true)
if [ -n "$VIEWER_TOKEN" ]; then
  HTTP_CODE=$(curl -s -o /dev/null -w "%{http_code}" -X POST "$BASE/ontology/object-types" \
    -H "Authorization: Bearer $VIEWER_TOKEN" -H "Content-Type: application/json" \
    -d '{"name":"test","display_name":"Test","properties":[]}')
  echo "  viewer 创建对象类型 → HTTP $HTTP_CODE (期望 403)"
fi

echo ""
echo "============================================="
echo "  部署完成！"
echo "============================================="
echo ""
echo "📌 账户:  admin/admin123 · editor/editor123 · viewer/viewer123"
echo "📌 前端:  http://localhost:5173"
echo "📌 API:   http://localhost:8000/docs"
echo ""
echo "📊 数据规模:"
echo "  7 种实体类型 · 335+ 对象 · 550+ 关联 · 6 种操作 · 3 条告警规则"
echo "  2 个 Workshop 应用 · 3 份知识库文档"
echo ""
echo "🔍 内嵌业务场景:"
echo "  ① SUP-015 泰源精密(C级) 质量恶化 → 告警+图谱追溯"
echo "  ② 13% 订单延迟 → AI 分析+自动预警"
echo "  ③ 涡轮增压器(PRT-10009) 涨价20% → 成本趋势分析"
echo "  ④ 广州工厂维护中 → 产能瓶颈识别"
echo "  ⑤ 18个月订单时间线 → 月度/季度聚合图表"
echo "  ⑥ 6国20家供应商 → 跨国供应链图谱"
echo "  ⑦ 8种物流承运商 → 物流追踪看板"
