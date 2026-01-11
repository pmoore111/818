import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useAuth } from "@/hooks/use-auth";
import { Check } from "lucide-react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";

export default function Subscription() {
  const { user } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const createCheckoutMutation = useMutation({
    mutationFn: async (data: { priceId: string; tier: string }) => {
      const res = await apiRequest("POST", "/api/subscriptions/create-checkout", data);
      return res.json();
    },
    onSuccess: (data) => {
      if (data.url) {
        window.location.href = data.url;
      }
    },
    onError: (error: Error) => {
      toast({
        title: "Error",
        description: error.message || "Failed to create checkout session",
        variant: "destructive",
      });
    },
  });

  const managePortalMutation = useMutation({
    mutationFn: async () => {
      const res = await apiRequest("POST", "/api/subscriptions/manage-portal", {});
      return res.json();
    },
    onSuccess: (data) => {
      if (data.url) {
        window.location.href = data.url;
      }
    },
    onError: (error: Error) => {
      toast({
        title: "Error",
        description: error.message || "Failed to open billing portal",
        variant: "destructive",
      });
    },
  });

  const currentTier = user?.subscription_tier || 'free';
  const isActive = user?.subscription_status === 'active';

  const plans = [
    {
      name: "Free",
      tier: "free",
      price: "$0",
      period: "forever",
      features: [
        "Up to 5 accounts",
        "Basic transaction tracking",
        "Calendar view",
        "Manual data entry",
      ],
      priceId: null,
    },
    {
      name: "Pro",
      tier: "pro",
      price: "$9",
      period: "per month",
      features: [
        "Unlimited accounts",
        "Advanced analytics",
        "CSV import",
        "PDF statement parsing",
        "AI financial assistant",
        "Priority support",
      ],
      priceId: process.env.STRIPE_PRO_PRICE_ID,
    },
    {
      name: "Business",
      tier: "business",
      price: "$29",
      period: "per month",
      features: [
        "Everything in Pro",
        "Multi-user access",
        "Team collaboration",
        "Advanced reporting",
        "API access",
        "Dedicated support",
      ],
      priceId: process.env.STRIPE_BUSINESS_PRICE_ID,
    },
  ];

  return (
    <div className="container mx-auto px-4 py-8 max-w-6xl">
      <div className="mb-8">
        <h1 className="text-3xl font-bold mb-2">Subscription Plans</h1>
        <p className="text-muted-foreground">
          Choose the plan that best fits your financial management needs
        </p>
        {isActive && (
          <div className="mt-4">
            <Badge variant="default">Current Plan: {currentTier.toUpperCase()}</Badge>
          </div>
        )}
      </div>

      <div className="grid md:grid-cols-3 gap-6 mb-8">
        {plans.map((plan) => {
          const isCurrentPlan = currentTier === plan.tier;
          const isPaidPlan = plan.tier !== 'free';

          return (
            <Card
              key={plan.tier}
              className={isCurrentPlan ? "border-primary shadow-lg" : ""}
            >
              <CardHeader>
                <div className="flex items-center justify-between mb-2">
                  <CardTitle>{plan.name}</CardTitle>
                  {isCurrentPlan && <Badge variant="default">Current</Badge>}
                </div>
                <div className="mb-4">
                  <span className="text-4xl font-bold">{plan.price}</span>
                  <span className="text-muted-foreground ml-2">{plan.period}</span>
                </div>
                <CardDescription>
                  {isPaidPlan ? "Full access to premium features" : "Perfect for getting started"}
                </CardDescription>
              </CardHeader>
              <CardContent>
                <ul className="space-y-3 mb-6">
                  {plan.features.map((feature) => (
                    <li key={feature} className="flex items-start gap-2">
                      <Check className="h-5 w-5 text-primary shrink-0 mt-0.5" />
                      <span className="text-sm">{feature}</span>
                    </li>
                  ))}
                </ul>
                {isCurrentPlan && isActive ? (
                  <Button
                    className="w-full"
                    variant="outline"
                    onClick={() => managePortalMutation.mutate()}
                    disabled={managePortalMutation.isPending}
                  >
                    {managePortalMutation.isPending ? "Loading..." : "Manage Subscription"}
                  </Button>
                ) : isPaidPlan && !isCurrentPlan ? (
                  <Button
                    className="w-full"
                    onClick={() => {
                      if (plan.priceId) {
                        createCheckoutMutation.mutate({
                          priceId: plan.priceId,
                          tier: plan.tier,
                        });
                      } else {
                        toast({
                          title: "Not Available",
                          description: "This plan is not configured yet. Please contact support.",
                          variant: "destructive",
                        });
                      }
                    }}
                    disabled={createCheckoutMutation.isPending}
                  >
                    {createCheckoutMutation.isPending ? "Loading..." : "Upgrade"}
                  </Button>
                ) : (
                  <Button className="w-full" variant="outline" disabled>
                    Current Plan
                  </Button>
                )}
              </CardContent>
            </Card>
          );
        })}
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Need Help?</CardTitle>
          <CardDescription>
            Have questions about our plans? Contact our support team.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">
            All paid plans include a 30-day money-back guarantee. Cancel anytime, no questions asked.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
