# Drop It

**Drop It** is an ultra-fast, zero-server, Peer-to-Peer (P2P) file sharing web application. Built with Next.js and WebRTC, it allows you to send files directly from your browser to another person's browser without ever touching a server.

![Next.js](https://img.shields.io/badge/Next.js-16-black)
![TypeScript](https://img.shields.io/badge/TypeScript-5-blue)
![WebRTC](https://img.shields.io/badge/WebRTC-P2P-orange)

## How It Works

Drop It uses **WebRTC** (via the [PeerJS](https://peerjs.com/) library) to establish a direct browser-to-browser data channel. Here's what happens under the hood:

1. **Signalling** — When you open the app, PeerJS assigns your browser a unique random ID via a signalling server. This server only helps peers find each other; it never sees your data.
2. **Connection** — Entering another peer's ID and clicking "Connect" initiates a WebRTC handshake. Once complete, data flows directly between the two browsers.
3. **File Transfer** — Files are sliced into 16 KB chunks and sent sequentially over the data channel. The receiver accumulates chunks in memory and reassembles them into a Blob when all chunks arrive.
4. **Download** — The receiver clicks "Save" to trigger a browser download of the reassembled file.

## Features

- **Direct P2P Transfer** — Files go straight from device to device. No middlemen, no cloud storage, no privacy concerns.
- **No Size Limits** — Since files aren't uploaded to a server, you can share files of any size without server limits.
- **Binary Chunking** — Robust file chunking (16 KB per chunk) for stable transfers across various network conditions.
- **Privacy First** — Your data stays in your browser's memory. No database, no logs.
- **Shareable Links** — Copy a link containing your peer ID so recipients auto-connect when they open it.
- **Modern UI** — Clean, responsive interface built with Tailwind CSS v4 and Shadcn UI.
- **Manual Download** — Control your storage: files are received into memory and only saved when you click "Save".

## Built With

| Tech | Purpose |
|------|---------|
| [Next.js](https://nextjs.org/) (16) | React framework with App Router |
| [React](https://react.dev/) (19) | UI library |
| [TypeScript](https://www.typescriptlang.org/) (5) | Type safety |
| [PeerJS](https://peerjs.com/) (1.5) | WebRTC abstraction (signalling + data channels) |
| [Tailwind CSS](https://tailwindcss.com/) (v4) | Utility-first CSS |
| [Shadcn UI](https://ui.shadcn.com/) | Reusable UI components (Button, Card, Input, Progress, Separator) |
| [Radix UI](https://www.radix-ui.com/) | Headless UI primitives (Slot, Progress, Separator) |
| [Lucide React](https://lucide.dev/) | Icons |

## Project Structure

```
app/
  api/health/route.ts     — Health check endpoint (GET /api/health)
  globals.css             — Global styles, Tailwind + Shadcn theming, light/dark vars
  layout.tsx              — Root layout (fonts, metadata, HTML shell)
  page.tsx                — Landing page (hero title, P2PShare, feature grid)
components/
  p2p-share.tsx           — CORE: P2P file transfer logic (PeerJS, chunking, connections)
  ui/
    button.tsx             — Reusable button with variants (CVA + Radix Slot)
    card.tsx               — Compound card component (Header, Title, Content, Footer, etc.)
    input.tsx              — Styled input with forwardRef
    progress.tsx           — Accessible progress bar (Radix Primitive)
    separator.tsx          — Horizontal/vertical divider (Radix Primitive)
hooks/
  useLocalStorage.ts      — Generic hook for persisting state to localStorage
lib/
  utils.ts                — cn() utility (clsx + tailwind-merge class merging)
```

The entire source codebase is extensively commented to help junior developers understand every pattern and decision.

## 🚀 Getting Started

### Prerequisites

- Node.js 18+
- pnpm (recommended) or npm

### Installation

```bash
git clone https://github.com/raghavdwd/drop-it.git
cd drop-it
pnpm install
pnpm dev
```

Open [http://localhost:3000](http://localhost:3000) in **two different browser windows** to test the P2P connection!

### Docker

```bash
docker build -t drop-it .
docker run -p 3000:3000 drop-it
```

## 📖 How to Use

1. **Get your ID** — When you open the app, a unique Peer ID is generated for you.
2. **Share your ID** — Copy your ID (or use the "Share Link" button) and send it to the recipient.
3. **Connect** — The recipient enters your ID and clicks "Connect".
4. **Drop Files** — Once connected, click the upload area to select files.
5. **Save** — The recipient clicks "Save" once the transfer is complete.

## 🔒 Security & Privacy

Drop It uses **WebRTC DataChannels**, which are encrypted by default (DTLS). Data is never stored on any server; PeerJS is only used for the initial handshake (signalling) to help the two browsers find each other. After the connection is established, all data flows directly between peers.

## Code Documentation

All source files include detailed block comments explaining:

- **Architecture decisions** — Why refs over state for chunk accumulation, why FileReader over streams, why forwardRef is needed, etc.
- **Design patterns** — Compound components (Card), variant management (CVA), Radix UI primitives, CSS custom property theming.
- **Data flow** — The three-message protocol (metadata → chunks → end), connection lifecycle, auto-connect from URL.
- **CSS theming** — How oklch colours work, light/dark mode via `.dark` class, the `@theme inline` directive in Tailwind v4.
