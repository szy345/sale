# 意尔康销售维保系统

面向门店局域网使用的维修、退货登记系统。可部署在 Windows 或 macOS 电脑上，店内其他电脑和手机通过浏览器访问。

## 功能

- 账号密码登录，管理员 / 操作员两种角色
- 维修单登记、查询、状态流转、多轮返厂
- 商品管理：维护货号、商品名称、颜色、尺码，维修登记时按货号下拉选择
- 退货单登记、查询、修改、删除
- 首页业务统计
- 可配置打印模板：A4、58/80mm 小票、40×30、50×30、60×40mm 盒贴标签
- 维修单号字号可单独放大，方便贴在鞋盒上查找
- 维修凭证二维码可扫码查询维修进度
- 可配置系统名称，侧边栏、登录页、浏览器标题和打印凭证同步更新
- 备份恢复：支持手动备份、每日自动备份、备份下载、自动清理和从备份恢复数据
- 30 天自助试用，机器码绑定，支持离线签名正式授权
- 操作审计日志
- 响应式页面，支持手机访问

## 试用与授权

新安装完成管理员初始化后，自动开始 **30 天试用**。

- 顶部显示“试用剩余 X 天”
- “系统管理 → 授权信息”可查看授权状态和机器码
- 管理员可导入厂商签发的 `.lic` 授权文件
- 到期后业务功能锁定，但登录、授权导入、数据备份恢复和系统升级仍可使用
- 公网维修进度查询页继续只读开放
- 授权文件绑定机器码，换电脑需要重新签发
- 试用状态同时保存在 ProgramData 和 `data` 目录，删除其中一个不会自动重置

正式授权由厂商使用 `licensing/` 目录中的工具签发：

- `licensing/private-key.pem` 是私钥，只保存在厂商电脑，不能打包给商户
- `server/license-public.pem` 是公钥，随系统发布
- 私钥丢失后无法再签发新授权，必须单独备份

现有商户升级到授权版本前，应先签发正式授权并在升级后导入，避免被锁定。

## 环境要求

- Windows 10 / Windows 11 / Windows Server
- 或 macOS 12 及以上（Intel / Apple Silicon 均可）
- **Node.js 24 LTS 或更高版本**（系统使用 Node 内置 SQLite，不需要额外安装数据库）
- Windows 建议部署目录：`D:\dbaops\sale`，不要放在 `C:\Program Files` 下，避免数据库写入权限问题
- macOS 建议放在用户目录，例如 `~/yearcon-sale`
- 默认使用 TCP 3000 端口

Node.js 下载：<https://nodejs.org/>

## Windows 首次安装

1. 安装 Node.js 24 LTS。
2. 双击运行 `scripts\windows\setup.bat`，安装依赖并构建前端。
3. 双击运行 `scripts\windows\start.bat` 启动系统。
4. 浏览器打开 <http://localhost:3000>。
5. 首次打开会进入“系统初始化”页面，创建第一个管理员账号。
6. 登录后进入“账号管理”，为店员创建操作员账号。

### 局域网访问

1. 以管理员身份运行 PowerShell。
2. 执行：

   ```powershell
   powershell -ExecutionPolicy Bypass -File scripts\windows\open-firewall.ps1
   ```

3. 查看本机 IP：

   ```powershell
   ipconfig
   ```

4. 其他电脑或手机访问：`http://本机IP:3000`。

建议在路由器中为服务器电脑设置固定 IP 或 DHCP 保留地址。

## Windows 开机自动启动

以管理员身份打开 PowerShell，执行：

```powershell
powershell -ExecutionPolicy Bypass -File scripts\windows\install-service.ps1
```

脚本会创建名为 `YearconSaleService` 的 Windows 任务计划，在开机时自动启动系统，并配置异常重启。

卸载自动启动：

```powershell
powershell -ExecutionPolicy Bypass -File scripts\windows\uninstall-service.ps1
```

## 停止系统

### Windows

- 前台运行：在启动窗口按 `Ctrl+C`，或直接关闭窗口
- 后台/服务运行：双击 `scripts\windows\stop.bat`
- 如果安装了开机任务，停止脚本会同时停止 `YearconSaleService` 任务和 3000 端口进程

也可以在任务管理器结束 Node.js 进程，或查看端口占用：

```powershell
netstat -ano | findstr :3000
```

### macOS

- 前台运行：在终端按 `Ctrl+C`
- 后台运行：执行：

```bash
bash scripts/macos/stop.sh
```

- 如果使用 pm2：

```bash
pm2 stop yearcon-sale
```

## Windows 离线安装（目标电脑不能联网）

离线电脑不需要执行 `npm install`。先在联网的 Windows 电脑上把生产依赖和前端一起打包，再复制到离线电脑。

### 1. 在联网电脑准备离线包

项目目录需要先有 `node_modules`（如果还没有，先执行 `npm ci`），然后运行：

```powershell
powershell -ExecutionPolicy Bypass -File scripts\windows\prepare-offline.ps1 -Zip
```

也可以直接双击 `scripts\windows\prepare-offline.bat`。

脚本会：

- 构建前端到 `public`
- 把程序文件复制到 `D:\dbaops\yearcon-offline`
- 在离线包中安装生产依赖 `node_modules`
- 可选生成 `yearcon-offline.zip`
- 不包含 `data` 目录，不会带走现有顾客数据

### 2. 下载 Node.js 安装文件

在联网电脑下载 **Node.js 24 LTS Windows x64**：

- 安装版：`.msi`
- 免安装版：`.zip`

把 Node.js 安装文件和离线包一起复制到 U 盘。

### 3. 在离线电脑安装

如果可以使用安装版：

1. 安装 Node.js 24 LTS
2. 解压离线包
3. 双击 `start.bat`
4. 浏览器打开 `http://localhost:3000`

如果没有管理员权限：

1. 解压离线包
2. 新建 `node` 文件夹
3. 把 Node.js ZIP 里的 `node.exe` 等文件放到 `node` 文件夹
4. 确认存在 `node\node.exe`
5. 双击 `start-portable.bat`

### 4. 注意事项

- **不要运行 `setup.bat`**：它需要联网执行 `npm ci`，离线电脑会失败
- 本离线包已经包含生产依赖和构建好的前端
- Node.js 24 已内置 SQLite，不需要安装数据库
- 首次运行会创建 `data` 目录并进入管理员初始化页面
- 如果要迁移旧数据，先停止旧系统，再把旧系统的整个 `data` 目录复制过来
- 局域网访问需要运行 `scripts\windows\open-firewall.ps1` 放行 3000 端口
- 二维码公网访问仍需内网穿透或公网服务器

## macOS 运行

系统核心是 Node.js + SQLite，支持在 MacBook 上运行。Windows 的 `.bat` 和 `.ps1` 启动脚本不适用于 macOS，系统已提供：

- `scripts/macos/setup.sh`：安装依赖和构建前端
- `scripts/macos/start.sh`：启动系统
- `scripts/macos/start.command`：可在 Finder 中双击启动

### 1. 安装 Node.js 24

从 <https://nodejs.org/> 安装 Node.js 24 LTS。安装后在终端确认：

```bash
node -v
```

需要显示 `v24.x.x` 或更高版本。

### 2. 复制项目并安装

把项目文件夹复制到 Mac，例如 `~/yearcon-sale`。不要直接复制 Windows 的 `node_modules`。

Windows 离线包包含 macOS 启动脚本，但不包含 macOS 版 Node。Mac 使用离线包时仍需安装 Node 24，并运行 `scripts/macos/setup.sh` 重新安装依赖和构建；如果 Mac 完全离线，请单独制作 macOS 离线包。

```bash
cd ~/yearcon-sale
chmod +x scripts/macos/setup.sh scripts/macos/start.sh scripts/macos/start.command scripts/macos/stop.sh
bash scripts/macos/setup.sh
```

如果是从 Windows 迁移现有数据，先把 Windows 上的整个 `data` 目录和 `config.json` 复制过来，再运行安装。不要同时运行 Windows 和 Mac 两份系统。

### 3. 启动

```bash
bash scripts/macos/start.sh
```

也可以在 Finder 中双击 `scripts/macos/start.command`。然后打开：

```text
http://localhost:3000
```

如果首次运行且没有复制 `data`，会进入初始化页面创建管理员。

### 4. 局域网访问

查看 Mac 的 Wi-Fi IP：

```bash
ipconfig getifaddr en0
```

其他电脑或手机访问：

```text
http://Mac的IP:3000
```

第一次运行时 macOS 可能弹出防火墙提示，请允许 Node.js 接受传入连接。

### 5. macOS 开机自启（可选）

可以使用 pm2：

```bash
sudo npm install -g pm2
pm2 start server/index.js --name yearcon-sale
pm2 save
pm2 startup
```

执行 `pm2 startup` 后按提示运行它输出的命令。查看日志：

```bash
pm2 logs yearcon-sale
```

> MacBook 合盖或休眠时服务会停止，局域网和公网都无法访问。作为长期服务器使用，建议保持接通电源并设置为不休眠，或继续使用 Windows 台式机作为服务器。

### 6. Mac 上的打印

系统使用浏览器打印。macOS 能识别到打印机时，可以直接使用 A4、小票或标签模板。

如果标签打印机/小票打印机只有 Windows 驱动，macOS 可能无法直接打印。这种情况下可以：

- 继续用 Windows 电脑负责打印
- 或更换支持 macOS 的打印机/网络打印机

### 7. 二维码和公网访问

如果把系统迁移到 Mac，请检查 `config.json` 中的 `publicBaseUrl`：

- 留空：自动使用 Mac 的局域网 IP
- 如果之前写死了 Windows 电脑的 IP，请改成 Mac 的 IP，或者清空
- 修改后重新打印维修凭证，二维码才会使用新地址

macOS 本身不会让局域网地址变成公网地址。如果需要顾客公网扫码，仍然需要内网穿透或公网服务器。

## 配置

编辑根目录 `config.json`：

```json
{
  "port": 3000,
  "host": "0.0.0.0",
  "shopName": "xxx",
  "shopPhone": "门店电话",
  "shopAddress": "门店地址",
  "publicBaseUrl": "",
  "tokenDays": 7
}
```

- `port`：服务端口
- `host`：`0.0.0.0` 表示允许局域网访问
- `shopName`、`shopPhone`、`shopAddress`：显示在打印凭证抬头
- `publicBaseUrl`：打印二维码使用的访问地址，例如 `http://192.168.0.104:3000`；留空时自动使用服务器局域网 IP
- `tokenDays`：登录有效期（天）

修改后需要重启服务。

## 使用说明

### 系统名称

管理员可在“系统管理 → 系统名称”中修改系统名称。保存后以下位置会同步使用该名称：

- 左侧菜单品牌名称
- 登录页和密码修改页
- 浏览器标题
- 打印凭证抬头和打印凭证说明文字

### 商品管理

在左侧“商品管理”中维护商品：

- 货号：唯一，不能重复；建议优先按货号识别商品
- 商品名称：同一名称可以有多个货号
- 颜色：可多选，支持直接输入自定义颜色
- 尺码：可多选，支持直接输入自定义尺码
- 规格组合：选择颜色和尺码后自动生成全部组合，例如 3 种颜色 + 5 个尺码 = 15 个规格；不需要的组合可以单独移除
- 备注：选填

在新增维修单时：

1. 先在“商品名称（按货号选择）”下拉框中按货号选择商品
2. 再选择该货号对应的颜色
3. 最后选择该颜色对应的尺码

系统会自动带出商品名称和货号，并校验颜色、尺码组合是否有效。清除商品选择后可手工填写商品信息。

操作员可以新增和编辑商品；删除商品仅管理员可操作。删除商品不会影响已登记的维修单，历史维修记录会保留当时的商品信息。

### 维修流程

维修单创建后状态为“待返厂维修”，后续按顺序登记：

```text
待返厂维修
  → 已返厂维修
  → 厂家已寄回
  → 已通知客户
  → 客户已取走
```

- 每次状态变更都会生成一条流转记录，包含操作人、操作日期、运单号、备注。
- 每轮最多四条状态记录，系统会在数据库层保证不会重复。
- “已返厂维修”必须填写返厂运单号。
- “厂家已寄回”可填写寄回运单号。
- “已通知客户”“客户已取走”无需填写运单号。
- 维修列表默认勾选“屏蔽客户已取走记录”，取消勾选后可查看已完成记录。
- 如果维修后仍有问题：
  - 在“厂家已寄回”或“客户已取走”状态下，点击“再次返厂”。
  - 系统会自动开启新一轮，历史记录完整保留。
- 管理员在维修详情页可以“撤销最近一次状态”，状态和轮次自动回退。

### 退货

退货模块仅登记信息，不做状态流转。可记录：

- 顾客姓名、电话、退货日期
- 商品名称、货号、颜色、尺码
- 购买日期、小票号
- 退货原因、处理方式（退款 / 换货 / 维修 / 其他）
- 退款或差价金额、备注

操作员可以新增和编辑；删除仅管理员可操作。

### 打印

维修详情、退货详情点击“打印凭证”，在页面顶部选择打印模板后点击“打印当前模板”。

系统默认提供：

- 50×30mm 盒贴标签（默认）
- 40×30mm 盒贴标签
- 60×40mm 盒贴标签
- 80mm 小票
- 58mm 小票
- A4 维修凭证

管理员和普通操作员都可以在“打印设置”中新增、修改和删除模板，并可单独设置：

- 纸张宽度、高度、页边距
- 维修单号字号
- 基础字号
- 二维码尺寸
- 是否显示问题、备注、流转记录、签字栏、门店地址
- 是否设为默认模板

盒贴标签默认使用较大维修单号字号，例如 50×30mm 标签为 20px，方便贴在鞋盒上查找。管理员可以根据实际标签纸调整字号。

浏览器打印操作：

1. 点击“打印当前模板”
2. 选择对应的标签/小票打印机
3. 选择正确的纸张尺寸（必须和模板一致）
4. 缩放选择 100%
5. 关闭“页眉和页脚”
6. 标签纸边距选择“无”

打印机驱动中需要提前把标签纸尺寸设置为自定义纸张，例如 50mm × 30mm。浏览器和系统只能设置打印模板，最终纸张尺寸仍由打印机驱动决定。

### 二维码查询维修进度

维修凭证上的二维码现在包含维修进度查询地址：

- 手机扫码后无需登录，即可查看当前维修状态、当前轮次和进度记录
- 顾客姓名、电话会做脱敏处理，不显示问题描述、操作人和运单号
- 手机需要和服务器处于同一局域网
- 如果自动识别的服务器 IP 不正确，请在 `config.json` 中设置 `publicBaseUrl`
- 旧凭证上的二维码内容仍然是旧格式，需要重新打印后才能扫码查询

### 权限

| 功能 | 管理员 | 操作员 |
| --- | --- | --- |
| 查看/新增/编辑维修单 | 是 | 是 |
| 维修状态流转、再次返厂 | 是 | 是 |
| 撤销维修状态 | 是 | 否 |
| 删除维修单 | 是 | 否 |
| 查看/新增/编辑退货单 | 是 | 是 |
| 删除退货单 | 是 | 否 |
| 查看/新增/编辑商品 | 是 | 是 |
| 删除商品 | 是 | 否 |
| 打印设置 | 是 | 是 |
| 系统名称设置 | 是 | 否 |
| 账号管理 | 是 | 否 |
| 备份恢复 | 是 | 否 |
| 系统升级 | 是 | 否 |
| 查看授权信息 | 是 | 是 |
| 导入授权 | 是 | 否 |
| 操作日志 | 是 | 否 |

## 数据与备份

所有业务数据都在：

```text
data\app.db
```

登录密钥在：

```text
data\secret.key
```

日志在：

```text
data\logs\
```

### 自动备份

管理员可在“系统管理 → 备份恢复”中设置自动备份：

- 默认启用，每天凌晨 02:00 自动备份
- 默认保留最近 30 份自动备份
- 备份文件保存在 `data\backups\`
- 到点时如果服务没有运行，会在下次启动服务后补做当天备份
- 自动清理只删除 `auto-` 开头的自动备份，手动备份和升级备份不会自动删除
- 可随时点击“立即备份”生成一份手动备份
- 可下载备份文件，或删除不需要的备份

> 自动备份需要系统服务处于运行状态。建议同时将 `data\backups` 定期复制到移动硬盘或 NAS，避免服务器硬盘损坏。

### 从备份恢复

管理员在“系统管理 → 备份恢复”中，选择需要恢复的备份文件，点击“恢复”：

1. 系统自动创建一份当前数据的备份
2. 系统停止服务，用选中的备份文件替换 `data\app.db`
3. 系统自动重启，页面会在服务恢复后刷新

恢复期间所有用户都无法使用。恢复完成后如果登录失效，重新登录即可。恢复前的当前数据备份会保留在备份列表中。

### 手动恢复备份（备用）

1. 停止系统服务。
2. 备份当前 `data\app.db` 到其他位置。
3. 将选中的备份文件复制为 `data\app.db`。
4. 重新启动系统。

> 不要删除 `data\secret.key`，否则所有账号需要重新登录。

### 升级

升级时只替换程序文件，**不要覆盖商户自己的 `data` 目录和 `config.json`**。数据库迁移会在新版本启动时自动执行。

#### 系统管理中的自动升级（推荐）

1.1.0 及以上版本支持在系统内自动升级。

准备：

1. 把新版本完整解压到一个**全新目录**，例如：
   ```text
   D:\yearcon-sale-v1.1
   ```
2. 新目录中的 `data` 必须是空的，不能包含商户数据。
3. 新目录必须包含 Node 运行时、生产依赖和构建好的前端（离线包已包含）。

操作：

1. 管理员进入“系统管理 → 系统升级”
2. 输入新系统目录，例如 `D:\yearcon-sale-v1.1`
3. 点击“检查新系统”
4. 检查通过后点击“开始升级”
5. 确认升级

系统会自动：

- 启动独立的升级进程
- 停止当前系统
- 把当前 `data` 和 `config.json` 复制到新目录
- 从新目录启动新版本
- 等待健康检查
- 成功后页面自动刷新
- 失败时自动重新启动旧系统

旧系统目录、旧数据和旧配置不会被修改，可以保留作为回滚版本。

如果当前系统安装了 `YearconSaleService` 开机任务，升级成功后会自动把任务路径更新到新目录。未安装开机任务时，页面会提示手动更新快捷方式。

> 从还没有“系统升级”页面的旧版本升级到 1.1.0，需要先按下面的手工流程升级一次；以后即可使用页面自动升级。

#### 商户是 Windows 离线安装（手工升级/首次升级）

1. 在新的联网电脑上准备最新完整离线包：
   ```powershell
   powershell -ExecutionPolicy Bypass -File scripts\windows\prepare-offline.ps1 -Zip
   ```
2. 在商户旧系统中进入“备份恢复”，点击“立即备份”，或手工复制整个 `data` 目录。
3. 停止旧系统：
   ```text
   scripts\windows\stop.bat
   ```
4. 把旧系统整个 `data` 目录和 `config.json` 复制到安全位置。
5. 把新离线包解压到新目录，例如：
   ```text
   D:\yearcon-sale-v1.1
   ```
6. 把旧系统的 `data` 目录和 `config.json` 复制到新目录。
7. 在新目录双击 `start-portable.bat`，打开页面检查：
   - 能正常登录
   - 原有维修单、退货单、商品、账号都在
   - 打印和二维码正常
   - 备份恢复页面正常
8. 确认无误后，更新桌面快捷方式。
9. 如果安装了 Windows 开机任务，在新目录运行：
   ```powershell
   powershell -ExecutionPolicy Bypass -File scripts\windows\install-service.ps1
   ```
   原任务会按新目录重新注册。
10. 保留旧目录和升级前的数据备份，确认稳定后再删除。

> 不要直接把新离线包中的 `data` 目录复制给商户，否则会覆盖商户数据。

#### 商户是 Windows 在线安装

```powershell
# 先备份 data，再停止服务
powershell -ExecutionPolicy Bypass -File scripts\windows\stop.bat

# 替换为新版本代码后，在项目目录执行
npm ci
npm run build

# 启动
node server\index.js
```

生产环境建议用 `start.bat` 或重新安装开机任务。

#### macOS

```bash
# 停止服务
bash scripts/macos/stop.sh
# 或
pm2 stop yearcon-sale
```

备份现有 `data` 和 `config.json`，替换代码后执行：

```bash
npm ci
npm run build
bash scripts/macos/start.sh
```

#### 数据库结构升级

如果新功能需要修改数据库结构，不需要手工执行 SQL。系统启动时会自动检查 `PRAGMA user_version` 并执行未完成的迁移：

- 迁移文件放在 `server/migrations/`，按 `008_xxx.sql` 顺序编号
- 不要修改已经在商户电脑上执行过的迁移文件，只能新增编号文件
- 每个迁移在事务中执行，失败会回滚当前迁移并停止启动
- 如果数据库已有数据并且存在待执行迁移，系统会先自动生成：
  ```text
  data\backups\pre-migration-v原版本号-时间.db
  ```
- 然后再按顺序执行迁移
- 迁移完成后 `PRAGMA user_version` 会更新为新版本号
- 自动升级前备份不会被自动清理，可在“备份恢复”中下载或恢复

> 即使系统会自动生成升级前备份，仍建议升级前手动点击一次“立即备份”。

发布新版本时必须：

1. 在测试环境复制一份商户数据库
2. 用新版本代码和这份数据库启动，确认迁移成功
3. 检查原有维修单、退货单、商品、账号和打印模板
4. 再按上面的离线/在线流程升级商户

#### 多商户升级建议

- 每个商户单独备份并单独升级，不要把 A 商户的 `data` 复制给 B 商户
- 先在一个测试安装或一个商户电脑上验证新功能
- 新版本会执行数据库迁移，升级前必须保留旧数据备份
- 如果新版本升级失败，恢复旧程序目录和升级前的 `data` 备份
- 由于数据库迁移通常不可逆，回滚程序时也要同时回滚到升级前的数据库备份
- 重点保留 `data\backups\pre-migration-*.db`，这是数据库结构升级前的最后一份完整备份

## 开发与验证

```bash
npm install
npm run dev      # 后端 3000 + Vite 5173
npm run lint     # ESLint
npm test         # 后端集成测试
npm run build    # 构建前端到 public
npm start        # 生产模式启动
```

开发模式访问 <http://localhost:5173>。

## 目录结构

```text
sale/
  server/               后端
    migrations/         SQLite 数据库迁移
    routes/             API 路由
    services/           业务逻辑
    middleware/         登录、权限、限流
    tests/              集成测试
  client/               前端 Vue 源码
    src/views/          页面
    src/components/     公共组件
  scripts/
    windows/            Windows 安装、启动、停止、服务、防火墙、离线打包脚本
    macos/              macOS 安装、启动、停止脚本
    common/             跨平台服务辅助脚本
  data/                 数据库、密钥、日志（运行时生成，不提交版本库）
  public/               前端构建产物（npm run build 生成）
  config.json           门店配置
```

## 常见问题

### 启动时提示端口被占用

```powershell
netstat -ano | findstr :3000
```

找到占用进程 PID 后，可在任务管理器中结束，或修改 `config.json` 的 `port`。

### 其他电脑无法访问

1. 确认服务器电脑和访问设备在同一局域网。
2. 运行 `scripts\windows\open-firewall.ps1` 放行 3000 端口。
3. 确认 `config.json` 中 `host` 为 `0.0.0.0`。
4. 检查 Windows 网络类型是否为“专用网络”。
5. 临时关闭第三方安全软件测试。

### Node.js 版本过低

系统使用 Node 24 内置的 `node:sqlite`。请升级到 Node.js 24 LTS 或更高版本。

### npm 安装依赖很慢

项目已配置 `.npmrc` 使用国内镜像 `https://registry.npmmirror.com`。如果仍失败，可尝试：

```bash
npm install --registry=https://registry.npmmirror.com
```

### 忘记管理员密码

如果还有其他管理员账号，可让其他管理员重置。若所有管理员密码都丢失，需要停止服务，使用 SQLite 工具重置 `users` 表中的密码哈希，或联系技术人员处理。请务必做好管理员账号备份。

### 打印内容被裁切

在浏览器打印预览中检查纸张尺寸和缩放比例。A4 建议选择“默认/100%”，80mm 小票请选择对应纸张宽度。

## 安全说明

- 本系统按**门店局域网内部使用**设计，默认使用 HTTP。
- 不要直接暴露到公网。如需公网访问，请通过 VPN、反向代理并启用 HTTPS。
- 密码使用 bcrypt 加密存储，登录使用 HttpOnly Cookie。
- 操作员无法管理账号和查看操作日志。
- 首次初始化时请设置强密码，并为每位店员分配独立账号，避免共用账号。
