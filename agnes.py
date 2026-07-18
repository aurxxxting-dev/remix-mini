import tkinter as tk
from tkinter import messagebox
import threading
import base64
import io
import os
import time
import json
import ctypes
import ctypes.wintypes
from PIL import ImageGrab, Image, ImageTk
import requests

API_KEY = "sk-XL2JPKrBt0tWUYCADppAHTs9g3mUTOVYSZNgVfaqH4AV1mHK"
API_URL = "https://apihub.agnes-ai.com/v1/images/generations"
OUTPUT_DIR = os.path.join(os.path.dirname(os.path.abspath(__file__)), "output")
os.makedirs(OUTPUT_DIR, exist_ok=True)

def copy_image_to_clipboard(img):
    from ctypes import wintypes
    import struct

    CF_DIB = 8
    user32 = ctypes.windll.user32
    kernel32 = ctypes.windll.kernel32

    output = io.BytesIO()
    img.convert("RGB").save(output, "BMP")
    data = output.getvalue()[14:]

    h_mem = kernel32.GlobalAlloc(0x0042, len(data))
    p_mem = kernel32.GlobalLock(h_mem)
    ctypes.memmove(p_mem, data, len(data))
    kernel32.GlobalUnlock(h_mem)

    user32.OpenClipboard(0)
    user32.EmptyClipboard()
    user32.SetClipboardData(CF_DIB, h_mem)
    user32.CloseClipboard()


class ScreenshotOverlay:
    def __init__(self, callback):
        self.callback = callback
        self.root = tk.Toplevel()
        self.root.attributes("-fullscreen", True)
        self.root.attributes("-topmost", True)
        self.root.configure(bg="black")
        self.root.attributes("-alpha", 0.4)
        self.root.cursor = "crosshair"

        self.canvas = tk.Canvas(self.root, bg="black", highlightthickness=0)
        self.canvas.pack(fill=tk.BOTH, expand=True)

        self.start_x = None
        self.start_y = None
        self.rect = None

        self.canvas.bind("<ButtonPress-1>", self.on_press)
        self.canvas.bind("<B1-Motion>", self.on_drag)
        self.canvas.bind("<ButtonRelease-1>", self.on_release)
        self.root.bind("<Escape>", lambda e: self.cancel())

        hint = tk.Label(self.root, text="拖拽选择区域  |  ESC 取消",
                        fg="white", bg="#333333", font=("Microsoft YaHei", 12),
                        padx=20, pady=8)
        hint.place(relx=0.5, rely=0.9, anchor="center")

    def on_press(self, event):
        self.start_x = event.x
        self.start_y = event.y
        if self.rect:
            self.canvas.delete(self.rect)
        self.rect = self.canvas.create_rectangle(
            self.start_x, self.start_y, self.start_x, self.start_y,
            outline="#6366f1", width=2, dash=(5, 3))

    def on_drag(self, event):
        if self.rect:
            self.canvas.coords(self.rect, self.start_x, self.start_y, event.x, event.y)

    def on_release(self, event):
        x1 = min(self.start_x, event.x)
        y1 = min(self.start_y, event.y)
        x2 = max(self.start_x, event.x)
        y2 = max(self.start_y, event.y)

        if x2 - x1 < 10 or y2 - y1 < 10:
            return

        self.root.destroy()
        self.callback((x1, y1, x2, y2))

    def cancel(self):
        self.root.destroy()
        self.callback(None)


class AgnesApp:
    def __init__(self):
        self.root = tk.Tk()
        self.root.title("Agnes")
        self.root.attributes("-topmost", True)
        self.root.overrideredirect(True)
        self.root.configure(bg="#1e1e23")

        win_w, win_h = 680, 100
        sw = self.root.winfo_screenwidth()
        x = (sw - win_w) // 2
        y = 30
        self.root.geometry(f"{win_w}x{win_h}+{x}+{y}")

        self.screenshot_data = None
        self.screenshot_thumb = None
        self.build_ui()
        self.make_draggable()
        self.root.mainloop()

    def build_ui(self):
        bg = "#1e1e23"

        top_bar = tk.Frame(self.root, bg=bg, height=18)
        top_bar.pack(fill=tk.X)
        title = tk.Label(top_bar, text="AGNES", fg="#555", bg=bg,
                         font=("Segoe UI", 8))
        title.pack()

        content = tk.Frame(self.root, bg=bg)
        content.pack(fill=tk.BOTH, expand=True, padx=12, pady=(0, 8))

        left = tk.Frame(content, bg=bg)
        left.pack(side=tk.LEFT)

        self.btn_shot = tk.Button(left, text="📷", width=4, height=1,
                                  font=("Segoe UI Emoji", 14),
                                  bg="#2a2a30", fg="#aaa", relief="flat",
                                  activebackground="#3a3a45", cursor="hand2",
                                  command=self.take_screenshot)
        self.btn_shot.pack(side=tk.LEFT)

        self.thumb_label = tk.Label(left, bg=bg)
        self.thumb_label.pack(side=tk.LEFT, padx=(8, 0))

        right = tk.Frame(content, bg=bg)
        right.pack(side=tk.LEFT, fill=tk.X, expand=True, padx=(10, 0))

        self.entry = tk.Entry(right, font=("Microsoft YaHei", 12),
                              bg="#2a2a30", fg="#e0e0e0", relief="flat",
                              insertbackground="#e0e0e0")
        self.entry.pack(side=tk.LEFT, fill=tk.X, expand=True, ipady=6)
        self.entry.bind("<Return>", lambda e: self.generate())

        self.btn_gen = tk.Button(right, text="▶", width=3,
                                 font=("Segoe UI", 12, "bold"),
                                 bg="#6366f1", fg="white", relief="flat",
                                 activebackground="#7c7ff7", cursor="hand2",
                                 command=self.generate)
        self.btn_gen.pack(side=tk.LEFT, padx=(8, 0))

        btn_x = tk.Button(content, text="✕", width=2,
                          font=("Segoe UI", 10), bg=bg, fg="#555",
                          relief="flat", activebackground="#ef4444",
                          cursor="hand2", command=self.root.destroy)
        btn_x.pack(side=tk.RIGHT)

        self.status = tk.Label(self.root, text="", fg="#666", bg=bg,
                               font=("Microsoft YaHei", 9))
        self.status.pack(fill=tk.X, padx=12, pady=(0, 6))

    def make_draggable(self):
        def start_drag(event):
            self._drag_x = event.x
            self._drag_y = event.y

        def drag(event):
            x = self.root.winfo_x() + event.x - self._drag_x
            y = self.root.winfo_y() + event.y - self._drag_y
            self.root.geometry(f"+{x}+{y}")

        for w in [self.root]:
            w.bind("<Button-1>", start_drag)
            w.bind("<B1-Motion>", drag)

    def set_status(self, text, color="#666"):
        self.status.config(text=text, fg=color)

    def take_screenshot(self):
        self.root.withdraw()
        self.root.after(300, self._do_screenshot)

    def _do_screenshot(self):
        img = ImageGrab.grab()

        def on_region(region):
            self.root.deiconify()
            if region is None:
                return
            x1, y1, x2, y2 = region
            cropped = img.crop((x1, y1, x2, y2))
            self.screenshot_data = cropped

            thumb = cropped.copy()
            thumb.thumbnail((40, 40))
            self.screenshot_thumb = ImageTk.PhotoImage(thumb)
            self.thumb_label.config(image=self.screenshot_thumb)
            self.set_status("截图完成", "#34d399")

        ScreenshotOverlay(on_region)

    def generate(self):
        prompt = self.entry.get().strip()
        if not prompt:
            self.set_status("请输入提示词", "#ef4444")
            return

        self.btn_gen.config(state="disabled")
        self.set_status("正在生成...", "#818cf8")

        threading.Thread(target=self._call_api, args=(prompt,), daemon=True).start()

    def _call_api(self, prompt):
        try:
            headers = {
                "Content-Type": "application/json",
                "Authorization": f"Bearer {API_KEY}",
            }

            if self.screenshot_data:
                buf = io.BytesIO()
                self.screenshot_data.save(buf, format="PNG")
                b64 = base64.b64encode(buf.getvalue()).decode()
                body = {
                    "model": "agnes-image-2.1-flash",
                    "prompt": prompt,
                    "size": "1024x1024",
                    "extra_body": {
                        "image": [f"data:image/png;base64,{b64}"],
                        "response_format": "b64_json",
                    },
                }
            else:
                body = {
                    "model": "agnes-image-2.1-flash",
                    "prompt": prompt,
                    "size": "1024x1024",
                    "return_base64": True,
                }

            resp = requests.post(API_URL, headers=headers, json=body, timeout=360)
            data = resp.json()

            img_b64 = data.get("data", [{}])[0].get("b64_json")
            if not img_b64:
                self.root.after(0, lambda: self.set_status(f"失败: {data}", "#ef4444"))
                return

            img_bytes = base64.b64decode(img_b64)
            result_img = Image.open(io.BytesIO(img_bytes))

            filepath = os.path.join(OUTPUT_DIR, f"agnes_{int(time.time()*1000)}.png")
            result_img.save(filepath)

            copy_image_to_clipboard(result_img)

            self.root.after(0, lambda: self._done(filepath))

        except Exception as e:
            self.root.after(0, lambda: self.set_status(f"错误: {e}", "#ef4444"))
        finally:
            self.root.after(0, lambda: self.btn_gen.config(state="normal"))

    def _done(self, filepath):
        self.screenshot_data = None
        self.thumb_label.config(image="")
        self.entry.delete(0, tk.END)
        self.set_status(f"已保存并复制  {os.path.basename(filepath)}", "#34d399")


if __name__ == "__main__":
    AgnesApp()
