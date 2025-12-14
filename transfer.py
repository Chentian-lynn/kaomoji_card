import sys

import cv2
import numpy as np
import svgwrite
from scipy.interpolate import splprep, splev


def png_to_svg_path(png_file, svg_file,
                    blur_ksize=13,      # 高斯模糊平滑
                    smooth_s=5.0,      # 样条平滑参数
                    num_points=400     # 曲线采样点
    ):

    # 读取 PNG
    img = cv2.imread(png_file, cv2.IMREAD_UNCHANGED)
    if img is None:
        raise FileNotFoundError("读取 PNG 失败：" + png_file)

    # 获取 alpha
    if img.shape[2] == 4:
        alpha = img[:, :, 3]
    else:
        gray = cv2.cvtColor(img, cv2.COLOR_BGR2GRAY)
        _, alpha = cv2.threshold(gray, 1, 255, cv2.THRESH_BINARY)

    h, w = alpha.shape

    # --- ① 自动移除贴边部分（避免闭合轮廓） ---
    if np.any(alpha[0, :] > 0): alpha[0, :] = 0
    if np.any(alpha[-1, :] > 0): alpha[-1, :] = 0
    if np.any(alpha[:, 0] > 0): alpha[:, 0] = 0
    if np.any(alpha[:, -1] > 0): alpha[:, -1] = 0

    # --- ② padding，避免高斯模糊时边缘扭曲 ---
    pad = 20
    alpha_padded = cv2.copyMakeBorder(
        alpha, pad, pad, pad, pad,
        cv2.BORDER_CONSTANT,
        value=0
    )

    # --- ③ 高斯模糊平滑 ---
    alpha_blur = cv2.GaussianBlur(alpha_padded, (blur_ksize, blur_ksize), 0)
    alpha = alpha_blur[pad:-pad, pad:-pad]

    # --- ④ 二值化 ---
    _, binary = cv2.threshold(alpha, 1, 255, cv2.THRESH_BINARY)

    # --- ⑤ 获取轮廓（非闭合，因为贴边已移除） ---
    contours, _ = cv2.findContours(binary, cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_NONE)
    if not contours:
        raise ValueError("未检测到轮廓")

    contour = max(contours, key=cv2.contourArea).squeeze().astype(float)

    # 如果 contour 太小，放弃
    if contour.ndim != 2 or contour.shape[0] < 10:
        raise ValueError("轮廓点过少")

    # --- ⑥ 样条拟合（非闭合 per=False） ---
    x = contour[:, 0]
    y = contour[:, 1]

    tck, u = splprep([x, y], s=smooth_s, per=False)  # 非闭合路径

    unew = np.linspace(0, 1, num_points)
    out = splev(unew, tck)

    px, py = out[0], out[1]
    points = list(zip(px, py))

    # --- ⑦ SVG 曲线路径（C 贝塞尔）非闭合 ---
    d = f"M {points[0][0]:.2f},{points[0][1]:.2f} "
    for i in range(1, len(points) - 2, 3):
        p1 = points[i]
        p2 = points[i+1]
        p3 = points[i+2]
        d += f"C {p1[0]:.2f},{p1[1]:.2f} {p2[0]:.2f},{p2[1]:.2f} {p3[0]:.2f},{p3[1]:.2f} "

    # 注意：这里不闭合，不加 Z！

    # --- ⑧ 保存 SVG ---
    dwg = svgwrite.Drawing(svg_file, size=(w, h))
    dwg.add(dwg.path(d=d, fill="none", stroke="black", stroke_width=2))
    dwg.save()

    print("生成 SVG：", svg_file)
    print("path d = ")
    print(d)

if __name__ == "__main__":
    if len(sys.argv) < 3:
        print("python transfer.py input.png output.svg")
    else:
        png_to_svg_path(sys.argv[1], sys.argv[2])
