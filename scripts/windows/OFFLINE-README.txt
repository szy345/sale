Windows 离线安装说明
====================

请先解压到有写入权限的目录，例如 D:\yearcon-offline，
不要放在 C:\Program Files 下，否则数据库可能无法写入。

0. 如果本目录存在 node\node.exe
   说明离线包已经内置 Node.js 便携运行时。
   直接双击 start-portable.bat 即可，不需要安装 Node.js。

1. 安装 Node.js 24 LTS
   需要提前在其他联网电脑下载 Node.js 24 Windows x64 安装包：
   https://nodejs.org/

   如果没有管理员权限，可下载 Node.js Windows ZIP 版本，
   解压后把 node.exe 等文件放到本目录下的 node 文件夹，
   然后运行 start-portable.bat。

2. 不要运行 setup.bat
   setup.bat 需要联网执行 npm ci，离线电脑会失败。
   本离线包已经包含生产依赖和构建好的前端。

3. 启动系统
   双击 start.bat
   或双击 start-portable.bat（使用本目录 node 文件夹中的 Node.js）

4. 浏览器打开
   http://localhost:3000
   首次运行会进入初始化页面，创建管理员账号。

5. 局域网访问
   运行 scripts\windows\open-firewall.ps1 放行 3000 端口（需要管理员权限）。
   其他电脑访问：http://本机IP:3000

6. 数据位置
   data\app.db
   data\secret.key
   data\backups\

7. 迁移旧数据
   先停止旧系统，再把旧系统的整个 data 目录复制到本目录。
   不要同时运行两份系统。

8. 二维码公网访问
   需要配置内网穿透或公网服务器，并修改 config.json 的 publicBaseUrl。
   修改后重新打印维修凭证。

9. 停止系统
   关闭启动窗口，或运行 scripts\windows\stop.bat。

10. 关于 macOS
   本包是 Windows x64 离线包，内置的是 Windows 版 Node。
   Mac 不能直接双击运行 start.bat。
   Mac 需要先安装 Node.js 24，再在终端运行：
   bash scripts/macos/setup.sh
   bash scripts/macos/start.sh
   如果 Mac 完全离线，请单独制作 macOS 离线包。
