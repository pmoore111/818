import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { TrendingUp, CreditCard, Calendar, Bot, ShieldCheck, ArrowRight } from "lucide-react";

export default function Landing() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-background via-background to-muted/30">
      <div className="container mx-auto px-4 py-8">
        <header className="flex items-center justify-between mb-16">
          <div className="flex items-center gap-2">
            <div className="text-3xl font-bold font-mono text-primary">8:18</div>
          </div>
          <Button asChild data-testid="button-login">
            <a href="/api/login">
              Sign In with Replit
              <ArrowRight className="ml-2 h-4 w-4" />
            </a>
          </Button>
        </header>

        <section className="text-center max-w-3xl mx-auto mb-20">
          <h1 className="text-4xl md:text-5xl font-bold mb-6 tracking-tight">
            Take Control of Your
            <span className="text-primary block mt-2">Personal & Business Finances</span>
          </h1>
          <blockquote className="text-lg italic text-muted-foreground mb-6 max-w-2xl mx-auto border-l-4 border-primary/40 pl-4 text-left">
            "But remember the LORD your God, for it is he who gives you the ability to produce wealth."
            <footer className="text-sm mt-2 not-italic text-right">— Deuteronomy 8:18</footer>
          </blockquote>
          <p className="text-base text-muted-foreground mb-8 max-w-2xl mx-auto">
            A private, self-hosted financial management app built on the foundation of faithful stewardship. Keep your personal and business finances separate while gaining clarity over your financial health.
          </p>
          <Button size="lg" asChild data-testid="button-get-started">
            <a href="/api/login">
              Get Started
              <ArrowRight className="ml-2 h-4 w-4" />
            </a>
          </Button>
        </section>

        <section className="grid md:grid-cols-2 lg:grid-cols-4 gap-6 mb-20">
          <Card className="hover-elevate">
            <CardHeader>
              <CreditCard className="h-10 w-10 text-primary mb-2" />
              <CardTitle>Account Tracking</CardTitle>
              <CardDescription>
                Track all your accounts in one place - checking, savings, credit cards, loans, and investments.
              </CardDescription>
            </CardHeader>
          </Card>

          <Card className="hover-elevate">
            <CardHeader>
              <TrendingUp className="h-10 w-10 text-primary mb-2" />
              <CardTitle>Transaction History</CardTitle>
              <CardDescription>
                Import and categorize transactions to understand where your money goes each month.
              </CardDescription>
            </CardHeader>
          </Card>

          <Card className="hover-elevate">
            <CardHeader>
              <Calendar className="h-10 w-10 text-primary mb-2" />
              <CardTitle>Due Date Calendar</CardTitle>
              <CardDescription>
                Never miss a payment with an integrated calendar showing all your financial obligations.
              </CardDescription>
            </CardHeader>
          </Card>

          <Card className="hover-elevate">
            <CardHeader>
              <Bot className="h-10 w-10 text-primary mb-2" />
              <CardTitle>AI Assistant</CardTitle>
              <CardDescription>
                Chat with an AI that understands your finances and provides personalized insights.
              </CardDescription>
            </CardHeader>
          </Card>
        </section>

        <section className="max-w-4xl mx-auto mb-20">
          <Card className="bg-primary/5 border-primary/20">
            <CardHeader className="text-center">
              <ShieldCheck className="h-12 w-12 text-primary mx-auto mb-4" />
              <CardTitle className="text-2xl">Private & Secure</CardTitle>
              <CardDescription className="text-base max-w-xl mx-auto">
                Your financial data stays with you. Self-hosted means you control your data, not a third party. Each user's data is completely isolated and protected.
              </CardDescription>
            </CardHeader>
          </Card>
        </section>

        <footer className="text-center text-muted-foreground text-sm py-8 border-t">
          <p>8:18 Finance Tracker - Faithful stewardship, designed for clarity</p>
        </footer>
      </div>
    </div>
  );
}
