import P2PShare from "@/components/p2p-share";

export default function Home() {
  return (
    <main className="container mx-auto py-10 px-4 min-h-screen flex flex-col items-center justify-center">
      <div className="text-center mb-10 space-y-2">
        <h1 className="text-5xl font-black tracking-tighter bg-gradient-to-r from-primary to-primary/50 bg-clip-text text-transparent">
          DROP IT
        </h1>
        <p className="text-muted-foreground font-medium">
          Zero-server Peer-to-Peer file sharing. Simple, fast, secure.
        </p>
      </div>

      <P2PShare />

      <div className="mt-20 grid grid-cols-1 md:grid-cols-3 gap-8 w-full max-w-4xl text-center">
        <div className="space-y-2">
          <div className="font-bold text-lg">No Servers</div>
          <p className="text-sm text-muted-foreground text-balance">
            Your files never touch anyone else's computer except the
            recipient's.
          </p>
        </div>
        <div className="space-y-2">
          <div className="font-bold text-lg">Fast Transfers</div>
          <p className="text-sm text-muted-foreground text-balance">
            Direct peer discovery and high-speed data channels for maximum
            speed.
          </p>
        </div>
        <div className="space-y-2">
          <div className="font-bold text-lg">Unlimited Size</div>
          <p className="text-sm text-muted-foreground text-balance">
            Share files of any size without worrying about server limits or
            storage.
          </p>
        </div>
      </div>
    </main>
  );
}
