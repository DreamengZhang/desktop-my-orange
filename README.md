# 卜卜

橘色桌面宠物。无边框、透明、置顶，眼睛在附近跟着鼠标，离开后回到正视。

## 直接运行

双击：

`dist/橘色卜卜 1.0.0.exe`

便携版，不用安装。首次打开若提示未知发布者，选择仍要运行。托盘悬停名称是「卜卜」。

改过代码后要重新打开这个 exe，正在运行的窗口不会自动换成新版本。

## 操作

- 拖动身子可以挪位置
- 滚轮放大、缩小
- 右键：放大、缩小、默认大小、重置到右下角、退出
- 托盘图标单击显示窗口，右键同样是菜单
- 位置和大小会记住，下次打开还在原地

默认宽度 220，最小 120，最大 520。

## 动作

精灵图是 9 列 × 6 行。

- 列：正视，以及上、右上、右、右下、下、左下、左、左上
- 行：轻轻起伏，偶尔眨眼
- 鼠标离眼睛大约一个身子以内才看过去；更近到脸上，或离开这个范围，都回到正视
- 眨眼大约隔几秒一次

## 技术

- 桌面端：Electron 39。主进程负责窗口、托盘、拖动和缩放，页面通过 preload 与主进程通信。
- 页面：原生 HTML、CSS、JavaScript，用一张精灵图切换动作。
- 打包：electron-builder，生成 Windows 便携版 exe。
- 立绘：打包前用 Python 和 Pillow 从 png 生成 webp，运行时不再使用。

## 开发

需要 Node.js。

```bash
npm install
npm start
```

也可以双击 `启动桌面卜.cmd`。

重新打包 Windows 便携程序：

```bash
npm run pack
```

产物在 `dist/橘色卜卜 1.0.0.exe`。

换立绘后，用 `tools/build_orange.py` 从 `src/assets/my-orange.png` 重新生成 `src/assets/my-orange.webp`，再执行 `npm run pack`。

## 文件

| 路径 | 作用 |
| --- | --- |
| `main.js` | 窗口、托盘、拖动、缩放 |
| `preload.js` | 页面和窗口之间的接口 |
| `src/renderer.js` | 眼神、眨眼、起伏 |
| `src/assets/my-orange.webp` | 动作精灵图 |
| `src/assets/my-orange.png` | 立绘原图 |
| `src/assets/icon.ico` | 程序图标 |
| `src/assets/tray.png` | 托盘图标 |

## 说明

窗口和动画逻辑为个人编写。立绘来自个人拥有的毛绒照片，仅供自己在桌面上使用，不是官方作品，也与 STAYREAL 无关。

`src/assets` 里的图片、图标，以及打包进 exe 的这些图，不授权复制、修改或再发布。收到权利人要求时会撤下。
