import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import {
  TrendingUp,
  TrendingDown,
  CreditCard,
  Wallet,
  CalendarClock,
  AlertCircle,
  ChevronLeft,
  ChevronRight,
  User,
  Briefcase,
} from "lucide-react";
import { 
  format, 
  parseISO, 
  isAfter, 
  isBefore, 
  addDays, 
  startOfMonth, 
  endOfMonth, 
  eachDayOfInterval, 
  isSameDay, 
  isSameMonth, 
  addMonths, 
  subMonths 
} from "date-fns";
import type { Account, Transaction, Obligation } from "@shared/schema";
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
} from "recharts";
import { useState } from "react";
import { Link } from "wouter";
import { Button } from "@/components/ui/button";
import { calculateFinancialTotals, formatCurrency } from "@/lib/finance-calculations";

function MetricCard({
  title,
  value,
  icon: Icon,
  trend,
  trendValue,
  variant = "default",
}: {
  title: string;
  value: string;
  icon: React.ElementType;
  trend?: "up" | "down";
  trendValue?: string;
  variant?: "default" | "personal" | "business";
}) {
  const bgClass = variant === "personal" 
    ? "bg-chart-2/10 dark:bg-chart-2/20" 
    : variant === "business" 
    ? "bg-chart-4/10 dark:bg-chart-4/20"
    : "";

  return (
    <Card className={bgClass}>
      <CardHeader className="flex flex-row items-center justify-between gap-2 space-y-0 pb-2">
        <CardTitle className="text-sm font-medium text-muted-foreground">
          {title}
        </CardTitle>
        <Icon className="h-4 w-4 text-muted-foreground" />
      </CardHeader>
      <CardContent>
        <div className="text-2xl font-bold font-mono tabular-nums">{value}</div>
        {trend && trendValue && (
          <p className="text-xs text-muted-foreground flex items-center gap-1 mt-1">
            {trend === "up" ? (
              <TrendingUp className="h-3 w-3 text-green-500" />
            ) : (
              <TrendingDown className="h-3 w-3 text-red-500" />
            )}
            <span className={trend === "up" ? "text-green-500" : "text-red-500"}>
              {trendValue}
            </span>
            <span>from last month</span>
          </p>
        )}
      </CardContent>
    </Card>
  );
}

function RecentTransactionRow({ transaction }: { transaction: Transaction }) {
  const isExpense = parseFloat(transaction.amount) < 0;
  
  return (
    <div className="flex items-center justify-between py-3 border-b last:border-0">
      <div className="flex flex-col gap-0.5">
        <span className="font-medium text-sm">{transaction.description}</span>
        <span className="text-xs text-muted-foreground">
          {format(parseISO(transaction.date), "MMM d, yyyy")} 
          {transaction.subcategory && ` • ${transaction.subcategory}`}
        </span>
      </div>
      <span
        className={`font-mono text-sm tabular-nums font-medium ${
          isExpense ? "text-red-500" : "text-green-500"
        }`}
      >
        {isExpense ? "-" : "+"}
        {formatCurrency(Math.abs(parseFloat(transaction.amount)))}
      </span>
    </div>
  );
}

function UpcomingObligationRow({ obligation }: { obligation: Obligation }) {
  const dueDate = parseISO(obligation.dueDate);
  const isOverdue = isBefore(dueDate, new Date()) && !obligation.isPaid;
  const isDueSoon = isAfter(dueDate, new Date()) && isBefore(dueDate, addDays(new Date(), 7));

  return (
    <div className="flex items-center justify-between py-3 border-b last:border-0">
      <div className="flex items-center gap-3">
        <div
          className={`h-2 w-2 rounded-full ${
            obligation.isPaid
              ? "bg-green-500"
              : isOverdue
              ? "bg-red-500"
              : isDueSoon
              ? "bg-yellow-500"
              : "bg-muted-foreground"
          }`}
        />
        <div className="flex flex-col gap-0.5">
          <span className="font-medium text-sm">{obligation.name}</span>
          <span className="text-xs text-muted-foreground">
            Due {format(dueDate, "MMM d, yyyy")}
          </span>
        </div>
      </div>
      <div className="flex items-center gap-2">
        <span className="font-mono text-sm tabular-nums">
          {formatCurrency(obligation.amount)}
        </span>
        <Badge
          variant={obligation.type === "personal" ? "secondary" : "outline"}
          className="text-xs"
        >
          {obligation.type}
        </Badge>
      </div>
    </div>
  );
}

export default function Dashboard() {
  const [currentMonth, setCurrentMonth] = useState(new Date());
  
  const { data: accounts, isLoading: accountsLoading } = useQuery<Account[]>({
    queryKey: ["/api/accounts"],
  });

  const { data: transactions, isLoading: transactionsLoading } = useQuery<Transaction[]>({
    queryKey: ["/api/transactions"],
  });

  const { data: obligations, isLoading: obligationsLoading } = useQuery<Obligation[]>({
    queryKey: ["/api/obligations"],
  });

  const personalAccounts = accounts?.filter((a) => a.type === "personal") || [];
  const businessAccounts = accounts?.filter((a) => a.type === "business") || [];

  const personalFinancials = calculateFinancialTotals(personalAccounts);
  const businessFinancials = calculateFinancialTotals(businessAccounts);

  const avgCreditScore = accounts?.length
    ? Math.round(
        accounts
          .filter((a) => a.creditScore)
          .reduce((sum, a) => sum + (a.creditScore || 0), 0) /
          accounts.filter((a) => a.creditScore).length || 0
      )
    : 0;

  const upcomingObligations =
    obligations
      ?.filter((o) => !o.isPaid)
      .sort((a, b) => new Date(a.dueDate).getTime() - new Date(b.dueDate).getTime())
      .slice(0, 5) || [];

  const recentTransactions = transactions?.slice(0, 8) || [];

  const spendingByCategory = transactions
    ?.filter((t) => parseFloat(t.amount) < 0)
    .reduce((acc, t) => {
      const cat = t.subcategory || "Other";
      acc[cat] = (acc[cat] || 0) + Math.abs(parseFloat(t.amount));
      return acc;
    }, {} as Record<string, number>);

  const pieData = Object.entries(spendingByCategory || {})
    .map(([name, value]) => ({ name, value }))
    .sort((a, b) => b.value - a.value)
    .slice(0, 5);

  const COLORS = [
    "hsl(var(--chart-1))",
    "hsl(var(--chart-2))",
    "hsl(var(--chart-3))",
    "hsl(var(--chart-4))",
    "hsl(var(--chart-5))",
  ];

  const monthlyData = transactions
    ?.reduce((acc, t) => {
      const month = format(parseISO(t.date), "MMM");
      if (!acc[month]) {
        acc[month] = { month, income: 0, expenses: 0 };
      }
      const amount = parseFloat(t.amount);
      if (amount > 0) {
        acc[month].income += amount;
      } else {
        acc[month].expenses += Math.abs(amount);
      }
      return acc;
    }, {} as Record<string, { month: string; income: number; expenses: number }>);

  const chartData = Object.values(monthlyData || {}).slice(-6);

  // Calendar Logic
  const monthStart = startOfMonth(currentMonth);
  const monthEnd = endOfMonth(currentMonth);
  const monthDays = eachDayOfInterval({ start: monthStart, end: monthEnd });
  const startDayOffset = monthStart.getDay();
  const paddedDays = [...Array(startDayOffset).fill(null), ...monthDays];

  const getObligationsForDate = (date: Date) => {
    return obligations?.filter((o) =>
      isSameDay(parseISO(o.dueDate), date)
    ) || [];
  };

  return (
    <div className="flex flex-col gap-6 p-6">
      <div className="flex flex-col gap-1">
        <h1 className="text-2xl font-semibold">Dashboard</h1>
        <p className="text-muted-foreground">
          Overview of your personal and business finances
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {accountsLoading ? (
          <>
            <Skeleton className="h-[120px]" />
            <Skeleton className="h-[120px]" />
            <Skeleton className="h-[120px]" />
            <Skeleton className="h-[120px]" />
          </>
        ) : (
          <>
            <MetricCard
              title="Personal Net Worth"
              value={formatCurrency(personalFinancials.netWorth)}
              icon={Wallet}
              variant="personal"
            />
            <MetricCard
              title="Business Net Worth"
              value={formatCurrency(businessFinancials.netWorth)}
              icon={CreditCard}
              variant="business"
            />
            <MetricCard
              title="Avg. Credit Score"
              value={avgCreditScore ? avgCreditScore.toString() : "N/A"}
              icon={TrendingUp}
            />
            <MetricCard
              title="Upcoming Bills"
              value={upcomingObligations.length.toString()}
              icon={CalendarClock}
            />
          </>
        )}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Calendar View on Front Page */}
        <Card className="lg:col-span-2">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <div>
              <CardTitle className="text-base font-semibold">Financial Calendar</CardTitle>
              <p className="text-xs text-muted-foreground">Upcoming payments & subscriptions</p>
            </div>
            <div className="flex items-center gap-1">
              <span className="text-sm font-medium mr-2">{format(currentMonth, "MMMM yyyy")}</span>
              <Button
                variant="ghost"
                size="icon"
                className="h-8 w-8"
                onClick={() => setCurrentMonth(subMonths(currentMonth, 1))}
              >
                <ChevronLeft className="h-4 w-4" />
              </Button>
              <Button
                variant="ghost"
                size="icon"
                className="h-8 w-8"
                onClick={() => setCurrentMonth(addMonths(currentMonth, 1))}
              >
                <ChevronRight className="h-4 w-4" />
              </Button>
            </div>
          </CardHeader>
          <CardContent>
            {obligationsLoading ? (
              <Skeleton className="h-[300px]" />
            ) : (
              <div className="grid grid-cols-7 gap-px bg-border rounded-lg overflow-hidden border">
                {["S", "M", "T", "W", "T", "F", "S"].map((day, i) => (
                  <div key={i} className="bg-muted/50 text-center py-1 text-[10px] font-bold text-muted-foreground uppercase">
                    {day}
                  </div>
                ))}
                {paddedDays.map((day, i) => {
                  if (!day) return <div key={`empty-${i}`} className="bg-background min-h-[60px]" />;
                  const dayObligations = getObligationsForDate(day);
                  const isToday = isSameDay(day, new Date());
                  const isCurrentMonth = isSameMonth(day, currentMonth);

                  return (
                    <div
                      key={day.toISOString()}
                      className={`bg-background p-1 min-h-[60px] border-t border-l first:border-l-0 ${
                        !isCurrentMonth ? "opacity-30" : ""
                      }`}
                    >
                      <div className="flex justify-between items-start mb-1">
                        <span className={`text-[10px] font-medium ${isToday ? "bg-primary text-primary-foreground w-4 h-4 rounded-full flex items-center justify-center" : ""}`}>
                          {format(day, "d")}
                        </span>
                      </div>
                      <div className="flex flex-col gap-0.5">
                        {dayObligations.slice(0, 2).map((o) => (
                          <div
                            key={o.id}
                            className={`text-[8px] leading-tight px-1 py-0.5 rounded truncate ${
                              o.isPaid 
                                ? "bg-muted text-muted-foreground" 
                                : o.type === "personal" 
                                ? "bg-chart-2/20 text-chart-2 font-medium" 
                                : "bg-chart-4/20 text-chart-4 font-medium"
                            }`}
                            title={`${o.name}: ${formatCurrency(o.amount)}`}
                          >
                            {o.name}
                          </div>
                        ))}
                        {dayObligations.length > 2 && (
                          <span className="text-[8px] text-muted-foreground pl-1">
                            +{dayObligations.length - 2} more
                          </span>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
            <div className="flex gap-4 mt-4 text-[10px] text-muted-foreground">
              <div className="flex items-center gap-1">
                <div className="w-2 h-2 rounded-full bg-chart-2" />
                <span>Personal</span>
              </div>
              <div className="flex items-center gap-1">
                <div className="w-2 h-2 rounded-full bg-chart-4" />
                <span>Business</span>
              </div>
              <div className="flex items-center gap-1 ml-auto">
                <Link href="/calendar" className="text-primary hover:underline font-medium">Full Calendar &rarr;</Link>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base font-semibold">Spending by Category</CardTitle>
          </CardHeader>
          <CardContent>
            {transactionsLoading ? (
              <Skeleton className="h-[280px]" />
            ) : pieData.length > 0 ? (
              <ResponsiveContainer width="100%" height={280}>
                <PieChart>
                  <Pie
                    data={pieData}
                    cx="50%"
                    cy="50%"
                    innerRadius={60}
                    outerRadius={100}
                    paddingAngle={2}
                    dataKey="value"
                    label={({ name, percent }) =>
                      `${name} ${(percent * 100).toFixed(0)}%`
                    }
                    labelLine={false}
                  >
                    {pieData.map((_, index) => (
                      <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip formatter={(value: number) => formatCurrency(value)} />
                </PieChart>
              </ResponsiveContainer>
            ) : (
              <div className="flex flex-col items-center justify-center h-[280px] text-muted-foreground">
                <AlertCircle className="h-10 w-10 mb-2" />
                <p>No spending data yet</p>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between gap-2">
            <CardTitle className="text-base font-semibold">Recent Transactions</CardTitle>
            <Badge variant="secondary" className="text-xs">
              {transactions?.length || 0} total
            </Badge>
          </CardHeader>
          <CardContent>
            {transactionsLoading ? (
              <div className="space-y-3">
                {[...Array(5)].map((_, i) => (
                  <Skeleton key={i} className="h-12" />
                ))}
              </div>
            ) : recentTransactions.length > 0 ? (
              <div className="flex flex-col">
                {recentTransactions.map((transaction) => (
                  <RecentTransactionRow key={transaction.id} transaction={transaction} />
                ))}
              </div>
            ) : (
              <div className="flex flex-col items-center justify-center py-8 text-muted-foreground">
                <CreditCard className="h-10 w-10 mb-2" />
                <p>No transactions yet</p>
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between gap-2">
            <CardTitle className="text-base font-semibold">Upcoming Obligations</CardTitle>
            <Badge variant="secondary" className="text-xs">
              {upcomingObligations.length} pending
            </Badge>
          </CardHeader>
          <CardContent>
            {obligationsLoading ? (
              <div className="space-y-3">
                {[...Array(5)].map((_, i) => (
                  <Skeleton key={i} className="h-12" />
                ))}
              </div>
            ) : upcomingObligations.length > 0 ? (
              <div className="flex flex-col">
                {upcomingObligations.map((obligation) => (
                  <UpcomingObligationRow key={obligation.id} obligation={obligation} />
                ))}
              </div>
            ) : (
              <div className="flex flex-col items-center justify-center py-8 text-muted-foreground">
                <CalendarClock className="h-10 w-10 mb-2" />
                <p>No upcoming obligations</p>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
