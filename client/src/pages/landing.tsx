import { Card, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { 
  ArrowRight, 
  Wallet, 
  Calendar, 
  PieChart, 
  Plus, 
  FileText, 
  BarChart3,
  ShieldCheck,
  Server,
  Layers
} from "lucide-react";

export default function Landing() {
  const scrollToFeatures = () => {
    document.getElementById("benefits")?.scrollIntoView({ behavior: "smooth" });
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-background via-background to-muted/30">
      <div className="container mx-auto px-4 py-8">
        <header className="flex items-center justify-between mb-12">
          <div className="flex items-center gap-2">
            <div className="text-3xl font-bold font-mono text-primary">8:18</div>
          </div>
          <Button asChild data-testid="button-login-header">
            <a href="/api/login">
              Sign In
              <ArrowRight className="ml-2 h-4 w-4" />
            </a>
          </Button>
        </header>

        <section className="text-center max-w-4xl mx-auto mb-24 pt-8">
          <p className="text-sm font-medium text-primary mb-4 tracking-wide uppercase">8:18</p>
          <h1 className="text-4xl md:text-5xl lg:text-6xl font-bold mb-6 tracking-tight">
            Steward Your Money With Clarity.
          </h1>
          <p className="text-xl text-muted-foreground mb-6 max-w-2xl mx-auto">
            Track personal + business accounts, due dates, and spending in one private, self-hosted dashboard.
          </p>
          
          <blockquote className="text-sm italic text-muted-foreground mb-8 max-w-lg mx-auto">
            "But remember the LORD your God, for it is he who gives you the ability to produce wealth."
            <footer className="text-xs mt-1 not-italic">— Deuteronomy 8:18</footer>
          </blockquote>

          <div className="flex flex-col sm:flex-row gap-4 justify-center mb-6">
            <Button size="lg" asChild data-testid="button-get-started">
              <a href="/api/login">
                Get Started
                <ArrowRight className="ml-2 h-4 w-4" />
              </a>
            </Button>
            <Button size="lg" variant="outline" onClick={scrollToFeatures} data-testid="button-see-features">
              See Features
            </Button>
          </div>

          <div className="flex flex-wrap items-center justify-center gap-x-6 gap-y-2 text-sm text-muted-foreground">
            <span className="flex items-center gap-1.5">
              <ShieldCheck className="h-4 w-4" />
              Private
            </span>
            <span className="flex items-center gap-1.5">
              <Server className="h-4 w-4" />
              Self-hosted
            </span>
            <span className="flex items-center gap-1.5">
              <Layers className="h-4 w-4" />
              Built for separation + simplicity
            </span>
          </div>
        </section>

        <section id="benefits" className="mb-24 scroll-mt-8">
          <h2 className="text-2xl md:text-3xl font-bold text-center mb-12">
            What you get in one place
          </h2>
          <div className="grid md:grid-cols-3 gap-6 max-w-5xl mx-auto">
            <Card className="hover-elevate">
              <CardHeader>
                <Wallet className="h-10 w-10 text-primary mb-3" />
                <CardTitle className="text-lg">Personal + Business Separation</CardTitle>
                <CardDescription className="text-base">
                  Know what's yours, what's your company's, and never mix them.
                </CardDescription>
              </CardHeader>
            </Card>

            <Card className="hover-elevate">
              <CardHeader>
                <Calendar className="h-10 w-10 text-primary mb-3" />
                <CardTitle className="text-lg">Due Date Calendar</CardTitle>
                <CardDescription className="text-base">
                  See what's due and when. Add links to pay in one click.
                </CardDescription>
              </CardHeader>
            </Card>

            <Card className="hover-elevate">
              <CardHeader>
                <PieChart className="h-10 w-10 text-primary mb-3" />
                <CardTitle className="text-lg">Real Debt Clarity</CardTitle>
                <CardDescription className="text-base">
                  Totals that make sense: owed vs limit vs available (no confusing negatives).
                </CardDescription>
              </CardHeader>
            </Card>
          </div>
        </section>

        <section className="mb-24">
          <h2 className="text-2xl md:text-3xl font-bold text-center mb-12">
            How it works
          </h2>
          <div className="grid md:grid-cols-3 gap-8 max-w-4xl mx-auto">
            <div className="text-center">
              <div className="flex items-center justify-center h-16 w-16 rounded-full bg-primary/10 text-primary mx-auto mb-4">
                <Plus className="h-8 w-8" />
              </div>
              <p className="text-sm text-muted-foreground mb-2">Step 1</p>
              <h3 className="font-semibold text-lg">Add your accounts</h3>
              <p className="text-muted-foreground text-sm mt-1">Bank + credit cards</p>
            </div>

            <div className="text-center">
              <div className="flex items-center justify-center h-16 w-16 rounded-full bg-primary/10 text-primary mx-auto mb-4">
                <FileText className="h-8 w-8" />
              </div>
              <p className="text-sm text-muted-foreground mb-2">Step 2</p>
              <h3 className="font-semibold text-lg">Import or enter transactions</h3>
              <p className="text-muted-foreground text-sm mt-1">CSV upload or manual entry</p>
            </div>

            <div className="text-center">
              <div className="flex items-center justify-center h-16 w-16 rounded-full bg-primary/10 text-primary mx-auto mb-4">
                <BarChart3 className="h-8 w-8" />
              </div>
              <p className="text-sm text-muted-foreground mb-2">Step 3</p>
              <h3 className="font-semibold text-lg">Track totals + due dates</h3>
              <p className="text-muted-foreground text-sm mt-1">Automatically calculated</p>
            </div>
          </div>
        </section>

        <section className="mb-24">
          <div className="max-w-4xl mx-auto">
            <div className="rounded-xl border bg-muted/30 p-8 md:p-12 flex items-center justify-center min-h-[300px]">
              <div className="text-center">
                <div className="flex items-center justify-center h-20 w-20 rounded-lg bg-primary/10 text-primary mx-auto mb-4">
                  <BarChart3 className="h-10 w-10" />
                </div>
                <p className="text-muted-foreground">Dashboard Preview</p>
              </div>
            </div>
            <p className="text-center text-muted-foreground mt-4">
              A clean dashboard you can understand fast.
            </p>
          </div>
        </section>

        <section className="mb-16">
          <Card className="max-w-3xl mx-auto bg-primary/5 border-primary/20">
            <CardHeader className="text-center py-12">
              <CardTitle className="text-2xl md:text-3xl mb-6">
                Take control of your finances — with faith and discipline.
              </CardTitle>
              <div className="flex flex-col sm:flex-row gap-4 justify-center">
                <Button size="lg" asChild data-testid="button-get-started-final">
                  <a href="/api/login">
                    Get Started
                    <ArrowRight className="ml-2 h-4 w-4" />
                  </a>
                </Button>
                <Button size="lg" variant="outline" asChild data-testid="button-sign-in-final">
                  <a href="/api/login">
                    Sign In
                  </a>
                </Button>
              </div>
            </CardHeader>
          </Card>
        </section>

        <footer className="text-center text-muted-foreground text-sm py-8 border-t">
          <p>8:18 Finance Tracker — Faithful stewardship, designed for clarity</p>
        </footer>
      </div>
    </div>
  );
}
