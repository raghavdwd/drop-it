import P2PShare from "@/components/p2p-share";

export default function Home() {
  return (
    <main className="min-h-screen bg-[#fafafa] dark:bg-[#050505] transition-colors duration-500 flex flex-col items-center justify-center p-6 md:p-24 selection:bg-primary/10 selection:text-primary">
      <div className="w-full max-w-4xl space-y-12">
        <div className="space-y-4 text-center animate-in fade-in slide-in-from-top-4 duration-1000">
          <h1 className="text-4xl md:text-5xl font-bold tracking-tight text-foreground/90">
            Drop It
          </h1>
          <p className="text-muted-foreground/60 text-sm md:text-base font-medium max-w-md mx-auto leading-relaxed uppercase tracking-[0.1em]">
            Ultra-fast P2P file sharing. No server, no limits, just direct transfer.
          </p>
        </div>
        
        <div className="animate-in fade-in zoom-in-95 duration-1000 delay-200">
          <P2PShare />
        </div>
      </div>
    </main>
  );
}
