# Superset 离线示例数据导入指南

## 背景

Superset 默认从 CDN (jsDelivr) 加载示例数据，URL 格式如下：
```
https://cdn.jsdelivr.net/gh/apache-superset/examples-data@master/birth_names2.json.gz
```

但在某些场景下（内网环境、离线部署、网络受限），需要使用本地 `examples-data/` 目录的数据。

本文档提供 **3 种方法** 将离线数据导入 Superset。

---

## 目录结构

```
superset-4.1-token/
├── examples-data/                  # 离线示例数据目录
│   ├── airports.csv.gz
│   ├── bart-lines.json.gz
│   ├── birth_france_data_for_country_map.csv
│   ├── birth_names2.json.gz        # USA Births Dashboard 数据
│   ├── countries.json.gz
│   ├── energy.json.gz
│   ├── flight_data.csv.gz
│   ├── multiformat_time_series.json.gz
│   ├── paris_iris.json.gz
│   ├── random_time_series.json.gz
│   ├── san_francisco.csv.gz
│   └── sf_population.json.gz
└── superset/
    └── examples/                   # 数据加载脚本
        ├── birth_names.py
        ├── world_bank.py
        ├── flights.py
        ├── ...
```

---

## 方法一：通过环境变量指向本地文件服务器（推荐）

### 步骤

#### 1. 启动本地静态文件服务器

在 `examples-data/` 目录启动一个简单的 HTTP 服务器：

**Windows (Python):**
```powershell
cd d:\workspace\superset-space\superset-github\superset-4.1-token\examples-data
python -m http.server 8080
```

**Linux/Mac:**
```bash
cd examples-data
python3 -m http.server 8080
# 或者使用 Node.js
npx serve -p 8080
```

#### 2. 设置环境变量

修改 `superset_config.py` 或在启动 Superset 前设置：

```python
# superset_config.py
import os

# 指向本地文件服务器（注意末尾的 /）
os.environ['SUPERSET_EXAMPLES_BASE_URL'] = 'http://localhost:8080/'

# 如果需要指定特定版本/分支
os.environ['SUPERSET_EXAMPLES_DATA_REF'] = 'local'
```

或者在命令行启动时设置：

**Windows:**
```powershell
set SUPERSET_EXAMPLES_BASE_URL=http://localhost:8080/
superset run -p 8188
```

**Linux/Mac:**
```bash
export SUPERSET_EXAMPLES_BASE_URL="http://localhost:8080/"
superset run -p 8188
```

#### 3. 加载示例数据

```bash
# 进入 Superset Python 环境
cd d:\workspace\superset-space\superset-github\superset-4.1-token

# 加载全部示例数据
superset load_examples

# 只加载元数据（不加载实际数据）
superset load_examples --only-metadata

# 强制重新加载（覆盖已有表）
superset load_examples --force

# 加载测试数据（包含更多示例）
superset load_examples --load-test-data
```

### 注意事项

- 本地服务器必须支持 `.gz` 压缩文件的访问
- URL 必须以 `/` 结尾
- 如果使用 HTTPS，需要配置证书

---

## 方法二：通过 Superset Web UI 手动导入

### 步骤

#### 1. 解压数据文件

部分数据文件是 `.gz` 格式，需要先解压：

```powershell
cd examples-data

# Windows (gzip)
gzip -d birth_names2.json.gz

# 或者使用 7-Zip / WinRAR
```

#### 2. 登录 Superset

访问 `http://localhost:8188`，使用 admin 账号登录。

#### 3. 创建数据库连接

1. 进入 **Settings → Database Connections**
2. 点击 **+ New Database**
3. 选择 **SQLite** 或 **PostgreSQL**（示例数据默认使用 SQLite）
4. 连接字符串：
   - SQLite: `sqlite:///superset.db`
   - PostgreSQL: `postgresql://user:pass@localhost/superset`

#### 4. 导入数据表

1. 进入 **SQL Lab → SQL Editor**
2. 执行以下 SQL 创建表：

```sql
-- 示例：导入 birth_names 数据
CREATE TABLE birth_names (
    ds DATETIME,
    gender VARCHAR(16),
    state VARCHAR(10),
    name VARCHAR(255),
    num BIGINT,
    num_boys BIGINT,
    num_girls BIGINT
);
```

3. 使用 Python 或 Pandas 导入数据：

```python
import pandas as pd
import sqlite3

# 读取本地 JSON 文件
df = pd.read_json('examples-data/birth_names2.json')

# 连接 Superset 数据库
conn = sqlite3.connect('superset.db')

# 导入数据
df.to_sql('birth_names', conn, if_exists='replace', index=False)
conn.close()
```

#### 5. 注册数据集

1. 进入 **Data → Datasets**
2. 点击 **+ New Dataset**
3. 选择数据库和表名
4. 配置列类型和时间列

#### 6. 创建图表和 Dashboard

1. 进入 **Charts → + New Chart**
2. 选择图表类型
3. 选择数据集
4. 配置可视化参数
5. 保存到 Dashboard

### 数据文件与 Dashboard 对应关系

| 数据文件 | Dashboard 名称 | 数据表名 |
| --- | --- | --- |
| `birth_names2.json.gz` | USA Births Names | `birth_names` |
| `countries.json.gz` | World Bank's Data | `wb_health_population` |
| `energy.json.gz` | Energy | `energy_usage` |
| `flight_data.csv.gz` | Flights | `flights` |
| `bart-lines.json.gz` | BART Lines | `bart_lines` |
| `random_time_series.json.gz` | Misc Charts | `random_time_series` |
| `san_francisco.csv.gz` | SF Population | `sf_population` |
| `paris_iris.json.gz` | Paris Iris | `paris_iris` |

---

## 方法三：自定义 Python 脚本导入

### 完整脚本示例

创建 `import_local_examples.py`：

```python
#!/usr/bin/env python
"""
Superset 离线示例数据导入脚本

使用方法:
    cd d:\workspace\superset-space\superset-github\superset-4.1-token
    python import_local_examples.py
"""
import os
import gzip
import json
import pandas as pd
from sqlalchemy import create_engine, inspect

# === 配置 ===
EXAMPLES_DATA_DIR = os.path.join(os.path.dirname(__file__), 'examples-data')
DATABASE_URL = 'sqlite:///superset.db'  # Superset 主数据库

# 数据文件配置
DATA_FILES = {
    'birth_names': {
        'file': 'birth_names2.json.gz',
        'columns': {
            'ds': 'DATETIME',
            'gender': 'VARCHAR(16)',
            'state': 'VARCHAR(10)',
            'name': 'VARCHAR(255)',
            'num': 'BIGINT',
        },
    },
    'wb_health_population': {
        'file': 'countries.json.gz',
        'columns': {
            'country_name': 'VARCHAR(255)',
            'country_code': 'VARCHAR(10)',
            'indicator_name': 'VARCHAR(255)',
            'indicator_code': 'VARCHAR(50)',
            'year': 'INTEGER',
            'value': 'FLOAT',
        },
    },
    'flights': {
        'file': 'flight_data.csv.gz',
        'columns': {
            'flight_date': 'DATE',
            'flight_hour': 'INTEGER',
            'flight_num': 'VARCHAR(20)',
            'origin': 'VARCHAR(10)',
            'destination': 'VARCHAR(10)',
        },
    },
    'random_time_series': {
        'file': 'random_time_series.json.gz',
        'columns': {
            'ds': 'DATETIME',
            'value': 'FLOAT',
        },
    },
}

def load_gz_json(filepath):
    """加载 .gz 压缩的 JSON 文件"""
    with gzip.open(filepath, 'rt', encoding='utf-8') as f:
        return json.load(f)

def load_gz_csv(filepath):
    """加载 .gz 压缩的 CSV 文件"""
    with gzip.open(filepath, 'rt', encoding='utf-8') as f:
        return pd.read_csv(f)

def import_table(table_name, config, engine):
    """导入单个数据表"""
    filepath = os.path.join(EXAMPLES_DATA_DIR, config['file'])
    
    if not os.path.exists(filepath):
        print(f"[WARN] 文件不存在: {filepath}")
        return False
    
    print(f"[INFO] 正在导入 {table_name}...")
    
    # 根据文件类型加载
    if config['file'].endswith('.json.gz'):
        data = load_gz_json(filepath)
        df = pd.DataFrame(data)
    elif config['file'].endswith('.csv.gz'):
        df = load_gz_csv(filepath)
    elif config['file'].endswith('.csv'):
        df = pd.read_csv(filepath)
    else:
        print(f"[ERROR] 不支持的文件格式: {config['file']}")
        return False
    
    # 处理时间列
    if 'ds' in df.columns:
        df['ds'] = pd.to_datetime(df['ds'], unit='ms', errors='coerce')
    
    # 写入数据库
    df.to_sql(
        table_name,
        engine,
        if_exists='replace',
        index=False,
        chunksize=500,
    )
    
    print(f"[OK] {table_name} 导入完成，共 {len(df)} 条记录")
    return True

def main():
    """主函数"""
    print("=" * 60)
    print("Superset 离线示例数据导入")
    print("=" * 60)
    print(f"数据目录: {EXAMPLES_DATA_DIR}")
    print(f"数据库: {DATABASE_URL}")
    print()
    
    # 创建数据库连接
    engine = create_engine(DATABASE_URL)
    
    # 检查示例数据目录
    if not os.path.isdir(EXAMPLES_DATA_DIR):
        print(f"[ERROR] 目录不存在: {EXAMPLES_DATA_DIR}")
        return
    
    # 导入每个数据表
    success_count = 0
    for table_name, config in DATA_FILES.items():
        if import_table(table_name, config, engine):
            success_count += 1
    
    print()
    print("=" * 60)
    print(f"导入完成: {success_count}/{len(DATA_FILES)} 个表")
    print("=" * 60)
    
    # 提示后续步骤
    print()
    print("后续步骤:")
    print("1. 在 Superset UI 中注册数据集 (Data → Datasets)")
    print("2. 运行 superset load_examples --only-metadata 创建 Dashboard")
    print("   或者手动创建图表")

if __name__ == '__main__':
    main()
```

### 运行脚本

```powershell
cd d:\workspace\superset-space\superset-github\superset-4.1-token

# 确保 Superset 已初始化
superset init

# 运行导入脚本
python import_local_examples.py

# 加载 Dashboard 元数据（使用已有的表）
superset load_examples --only-metadata
```

---

## 方法四：修改 helpers.py 使用本地路径（高级）

如果不想启动 HTTP 服务器，可以直接修改 Superset 的 `helpers.py`：

### 修改文件

编辑 `superset/examples/helpers.py`：

```python
# 在文件顶部添加
import os
from superset import app

# 修改 get_example_url 函数
def get_example_url(filepath: str) -> str:
    """Return URL to example data file.
    
    优先使用本地 examples-data 目录，否则使用 CDN。
    """
    # 本地离线数据目录
    local_path = os.path.join(
        os.path.dirname(app.config["BASE_DIR"]),
        "examples-data",
        filepath
    )
    
    if os.path.exists(local_path):
        # 返回本地文件路径（pandas 可以直接读取）
        return local_path
    
    # 否则使用 CDN
    return f"{BASE_URL}{filepath}"
```

### 注意事项

- 这种方式需要修改 Superset 源码
- 升级 Superset 版本时可能丢失修改
- 需要重启 Superset 服务

---

## 常见问题

### Q1: 加载示例数据报错 "Connection refused"

**原因**: 本地文件服务器未启动或端口错误

**解决**: 确保 HTTP 服务器在 `localhost:8080` 运行：
```powershell
curl http://localhost:8080/birth_names2.json.gz
```

### Q2: 表已存在错误

**解决**: 使用 `--force` 参数覆盖：
```bash
superset load_examples --force
```

### Q3: 时间列解析错误

**原因**: JSON 文件中的时间戳是毫秒格式

**解决**: 在导入脚本中转换：
```python
df['ds'] = pd.to_datetime(df['ds'], unit='ms')
```

### Q4: PostgreSQL 数据库导入失败

**原因**: PostgreSQL 不支持 `DATETIME`，应使用 `TIMESTAMP`

**解决**: 修改列类型：
```python
dtype={
    'ds': 'TIMESTAMP',
    'gender': 'VARCHAR(16)',
    ...
}
```

---

## 数据文件详细说明

### birth_names2.json.gz

**用途**: USA Births Names Dashboard
**字段**:
- `ds`: 时间戳（毫秒）
- `gender`: 性别 (boy/girl)
- `state`: 美国州代码
- `name`: 名字
- `num`: 出生数量
- `num_boys`: 男婴数量
- `num_girls`: 女婴数量

### countries.json.gz

**用途**: World Bank Dashboard
**字段**:
- `country_name`: 国家名
- `country_code`: 国家代码
- `indicator_name`: 指标名称
- `indicator_code`: 指标代码
- `year`: 年份
- `value`: 指标值

### flight_data.csv.gz

**用途**: Flights Dashboard
**字段**:
- `flight_date`: 日期
- `flight_hour`: 小时
- `flight_num`: 航班号
- `origin`: 出发地
- `destination`: 目的地

### energy.json.gz

**用途**: Energy Dashboard
**字段**:
- `source`: 能源来源
- `year`: 年份
- `value`: 能源值

---

## 总结

| 方法 | 适用场景 | 优点 | 缺点 |
| --- | --- | --- | --- |
| **环境变量 + HTTP 服务器** | 完整导入全部示例 | 最接近官方流程 | 需启动额外服务 |
| **Web UI 手动导入** | 选择性导入少量数据 | 灵活可控 | 操作繁琐 |
| **自定义 Python 脚本** | 批量导入、自动化 | 可定制 | 需编写脚本 |
| **修改源码** | 深度定制 | 无需 HTTP 服务 | 升级时丢失修改 |

推荐使用 **方法一（环境变量 + HTTP 服务器）**，这是最接近官方流程且不需要修改源码的方式。