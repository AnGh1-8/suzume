# 🦅 Suzume

**Suzume** is a high-performance, keyboard-centric PDF reader built for speed and efficiency. Inspired by Vim, it offers a mouseless navigation experience, making it ideal for power users who want to fly through documents without leaving the keyboard.

Built with **Next.js 16 (Turbopack)**, **React PDF**, and **Zustand**.

## 📸 Screenshots

### Landing Page

![Landing Page](assets/landing.png)
_Clean startup interface_

### PDF Reader

![PDF Reader](assets/reader.png)
_Distraction-free reading with Vim bindings_

### Help Menu

![Help Menu](assets/help.png)
_Keyboard shortcuts reference_

## ✨ Features

- **vim-like Navigation**: Navigate documents using `j`, `k`, `d`, `u`, `gg`, `G` and more.
- **Command Mode**: Type `:` to access commands like `:w` (width), `:z` (zoom), and `:dark`.
- **Keyboard-Driven Outline**: Browse the table of contents, expand/collapse sections (`h`/`l`), and jump to chapters (`Enter`) entirely via keyboard.
- **Dark Mode**: Built-in optimized dark mode for comfortable late-night reading.
- **Focus Management**: Toggle focus seamlessly between the PDF content and the Outline sidebar using `Esc`.
- **Performance**: Virtualized list rendering (via `react-window`) ensures buttery smooth scrolling even for massive PDFs.
- **Smart Scaling**:
    - `:w [num]` - Fit width (e.g., `:w 80` for 80%).
    - `:z [num]` - Custom zoom level.
    - `:fit` - Fit whole page.

## 🚀 Getting Started

### Prerequisites

- Node.js 18+
- npm / yarn / pnpm

### Installation

1.  Clone the repository:

    ```bash
    git clone https://github.com/AbyssSkb/suzume.git
    cd suzume
    ```

2.  Install dependencies:

    ```bash
    npm install
    ```

3.  Run the development server:

    ```bash
    npm run dev
    ```

4.  Open [http://localhost:3000](http://localhost:3000) to start reading.

## ⌨️ Keyboard Shortcuts

Press `?` in the app to view the full help menu.

### Navigation (PDF)

| Key        | Action                  |
| :--------- | :---------------------- |
| `j` / `k`  | Scroll Down / Up        |
| `d` / `u`  | Fast Scroll Down / Up   |
| `h` / `l`  | Previous / Next Page    |
| `Ctrl + o` | Jump Back in History    |
| `Ctrl + i` | Jump Forward in History |
| `gg`       | Go to First Page        |
| `G`        | Go to Last Page         |
| `zz`       | Center Page in View     |

### Outline / Sidebar

| Key       | Action                       |
| :-------- | :--------------------------- |
| `t`       | Toggle Sidebar Visibility    |
| `Esc`     | Toggle Focus (PDF ↔ Outline) |
| `j` / `k` | Navigate Items               |
| `l` / `h` | Expand / Collapse Section    |
| `Enter`   | Jump to Chapter              |

### View Control

| Command            | Description                                |
| :----------------- | :----------------------------------------- |
| `:w [num]`         | Fit Width (default 90%). Example: `:w 100` |
| `:z [num]`         | Set Zoom %. Example: `:z 150`              |
| `:fit`             | Fit Whole Page                             |
| `:fs`              | Toggle Fullscreen                          |
| `:dark` / `:light` | Switch Theme                               |

## 🛠️ Tech Stack

- **Framework**: [Next.js 16](https://nextjs.org/)
- **PDF Rendering**: [react-pdf](https://github.com/wojtekmaj/react-pdf)
- **Virtualization**: [react-window](https://github.com/bvaughn/react-window)
- **State Management**: [Zustand](https://github.com/pmndrs/zustand)
- **Styling**: [Tailwind CSS](https://tailwindcss.com/)
- **Icons**: [Lucide React](https://lucide.dev/)

## 📄 License

MIT
