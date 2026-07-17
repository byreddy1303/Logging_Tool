export default function LoadingScreen() {
  return (
    <div className="flex min-h-dvh items-center justify-center bg-bg">
      <div className="text-center">
        <p className="animate-pulse font-display text-[22px] font-bold tracking-tight text-text">
          AIR<span className="text-accent">.</span>
        </p>
        <p className="u-label mt-1">loading</p>
      </div>
    </div>
  );
}
