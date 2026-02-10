# 🚀 Drop It

**Drop It** is a ultra-fast, zero-server, Peer-to-Peer (P2P) file sharing web application. Built with Next.js and WebRTC, it allows you to send files directly from your browser to another person's browser without ever touching a server.

![Next.js](https://img.shields.io/badge/Next.js-15-black)
![TypeScript](https://img.shields.io/badge/TypeScript-5-blue)
![WebRTC](https://img.shields.io/badge/WebRTC-P2P-orange)

## ✨ Features

- **Direct P2P Transfer**: Files go straight from device to device. No middlemen, no cloud storage, no privacy concerns.
- **No Size Limits**: Since files aren't uploaded to a server, you can share files of any size without server limits.
- **Binary Chunking**: Implements robust file chunking for stable transfers across various network conditions.
- **Privacy First**: Your data stays in your browser's memory. No database logs.
- **Modern UI**: Clean, responsive interface built with Tailwind CSS and Shadcn UI.
- **Manual Download**: Control your storage—files are received into memory and only saved when you click "Save".

## 🛠️ Built With

- [Next.js](https://nextjs.org/) - Frontend Framework
- [PeerJS](https://peerjs.com/) - WebRTC Implementation
- [Tailwind CSS](https://tailwindcss.com/) - Styling
- [Lucide React](https://lucide.dev/) - Icons
- [Shadcn UI](https://ui.shadcn.com/) - Components

## 🚀 Getting Started

### Prerequisites

- Node.js 18+
- pnpm (recommended) or npm

### Installation

1. Clone the repository:

   ```bash
   git clone https://github.com/raghavdwd/drop-it.git
   cd drop-it
   ```

2. Install dependencies:

   ```bash
   pnpm install
   ```

3. Start the development server:

   ```bash
   pnpm dev
   ```

4. Open [http://localhost:3000](http://localhost:3000) in two different browser windows to test the P2P connection!

## 📖 How to Use

1. **Get your ID**: When you open the app, a unique Peer ID is generated for you.
2. **Share your ID**: Copy your ID and send it to the recipient.
3. **Connect**: The recipient enters your ID and clicks "Connect".
4. **Drop Files**: Once connected, simply drag and drop files or click to select.
5. **Save**: The recipient clicks "Save" once the transfer is complete.

## 🔒 Security & Privacy

Drop It uses **WebRTC DataChannels**, which are encrypted by default (DTLS). Data is never stored on any server; PeerJS is only used for the initial "handshake" (signaling) to help the two browsers find each other.
