import Link from "next/link";

export default function HomePage() {
  return (
    <div className="min-h-screen bg-background">
      {/* Hero Section */}
      <div className="relative overflow-hidden">
        {/* Background gradient */}
        <div className="absolute inset-0 bg-hero-gradient opacity-10" />
        <div className="absolute inset-0 bg-gradient-to-b from-transparent via-background/50 to-background" />

        {/* Grid pattern */}
        <div className="absolute inset-0 opacity-[0.02] dark:opacity-[0.05]" style={{
          backgroundImage: `url("data:image/svg+xml,%3csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 32 32' width='32' height='32' fill='none' stroke='%23000'%3e%3cpath d='M0 .5H31.5V32'/%3e%3c/svg%3e")`,
        }} />

        <div className="relative max-w-6xl mx-auto px-6 py-24 md:py-32">
          <div className="text-center space-y-8">
            {/* Logo */}
            <div className="flex items-center justify-center gap-3 mb-8">
              <div className="w-14 h-14 rounded-2xl bg-hero-gradient flex items-center justify-center shadow-glow-lg">
                <span className="text-white font-bold text-2xl">T</span>
              </div>
              <h1 className="text-4xl font-display font-bold text-gradient">TellSpike</h1>
            </div>

            {/* Headline */}
            <h2 className="text-4xl md:text-6xl font-display font-bold leading-tight max-w-4xl mx-auto">
              Google Ads Analytics
              <span className="block text-gradient">Made Simple</span>
            </h2>

            <p className="text-xl text-muted-foreground max-w-2xl mx-auto">
              Monitor your Google Ads performance, detect anomalies instantly, and understand your ROAS in plain language. Built for marketers who want clarity, not complexity.
            </p>

            {/* CTAs */}
            <div className="flex flex-col sm:flex-row items-center justify-center gap-4 pt-4">
              <Link href="/dashboard" className="btn-primary text-lg px-8 py-3">
                View Dashboard
              </Link>
              <Link href="/login" className="btn-secondary text-lg px-8 py-3">
                Sign In
              </Link>
            </div>
          </div>
        </div>
      </div>

      {/* Features Section */}
      <div className="max-w-6xl mx-auto px-6 py-24">
        <div className="text-center mb-16">
          <h3 className="text-3xl font-display font-bold mb-4">Why TellSpike?</h3>
          <p className="text-muted-foreground text-lg">Powerful features designed for modern advertisers</p>
        </div>

        <div className="grid md:grid-cols-3 gap-6">
          {/* Feature 1 */}
          <div className="kpi-card">
            <div className="w-12 h-12 rounded-xl bg-primary-500/20 flex items-center justify-center mb-4">
              <svg className="w-6 h-6 text-primary-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" />
              </svg>
            </div>
            <h4 className="text-xl font-display font-semibold mb-2">Spike Detection</h4>
            <p className="text-muted-foreground">
              Instantly detect anomalies in your campaigns with our z-score based algorithm. Get alerted before problems become costly.
            </p>
          </div>

          {/* Feature 2 */}
          <div className="kpi-card">
            <div className="w-12 h-12 rounded-xl bg-success-500/20 flex items-center justify-center mb-4">
              <svg className="w-6 h-6 text-success-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </div>
            <h4 className="text-xl font-display font-semibold mb-2">Plain Language ROI</h4>
            <p className="text-muted-foreground">
              Understand your returns in simple terms: For every Rs.1 spent, you earned Rs.X back. No confusing metrics.
            </p>
          </div>

          {/* Feature 3 */}
          <div className="kpi-card">
            <div className="w-12 h-12 rounded-xl bg-accent-500/20 flex items-center justify-center mb-4">
              <svg className="w-6 h-6 text-accent-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
              </svg>
            </div>
            <h4 className="text-xl font-display font-semibold mb-2">Smart Alerts</h4>
            <p className="text-muted-foreground">
              Get notified via email, Slack, or webhooks. Set custom thresholds and quiet hours to match your workflow.
            </p>
          </div>
        </div>
      </div>

      {/* Footer */}
      <footer className="border-t border-border">
        <div className="max-w-6xl mx-auto px-6 py-8">
          <div className="flex flex-col md:flex-row items-center justify-between gap-4">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-lg bg-hero-gradient flex items-center justify-center">
                <span className="text-white font-bold text-sm">T</span>
              </div>
              <span className="font-display font-semibold">TellSpike</span>
            </div>
            <p className="text-sm text-muted-foreground">
              Built with Google Ads API. Not affiliated with Google.
            </p>
          </div>
        </div>
      </footer>
    </div>
  );
}
