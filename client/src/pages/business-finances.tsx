import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Input } from "@/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { CSVImportDialog } from "@/components/statement-import-dialog";
import {
  Plus,
  Briefcase,
  CreditCard,
  TrendingUp,
  Building2,
  ArrowUpRight,
  ArrowDownRight,
  DollarSign,
  Upload,
  ChevronDown,
  ChevronRight,
  Trash2,
  Settings,
} from "lucide-react";
import { format, parseISO, subMonths, addMonths } from "date-fns";
import type { Account, Transaction } from "@shared/schema";

function formatCurrency(value: string | number): string {
  const num = typeof value === "string" ? parseFloat(value) : value;
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
  }).format(num);
}

const accountFormSchema = z.object({
  name: z.string().min(1, "Name is required"),
  category: z.string().min(1, "Category is required"),
  balance: z.string().optional(),
  creditLimit: z.string().optional(),
  creditScore: z.string().optional(),
  interestRate: z.string().optional(),
  dueDay: z.string().optional(),
  statementDay: z.string().optional(),
});

function getCategoryIcon(category: string) {
  switch (category) {
    case "checking":
      return <Building2 className="h-4 w-4" />;
    case "credit_card":
      return <CreditCard className="h-4 w-4" />;
    case "loan":
      return <DollarSign className="h-4 w-4" />;
    case "investment":
      return <TrendingUp className="h-4 w-4" />;
    default:
      return <Briefcase className="h-4 w-4" />;
  }
}

interface StatementPeriod {
  label: string;
  startDate: string;
  endDate: string;
  transactions: Transaction[];
  total: number;
}

function getStatementPeriods(
  transactions: Transaction[],
  statementDay: number = 1
): StatementPeriod[] {
  if (transactions.length === 0) return [];

  const periods: Map<string, StatementPeriod> = new Map();
  
  transactions.forEach((t) => {
    const txDate = parseISO(t.date);
    const day = txDate.getDate();
    
    let periodStart: Date;
    if (day >= statementDay) {
      periodStart = new Date(txDate.getFullYear(), txDate.getMonth(), statementDay);
    } else {
      periodStart = subMonths(new Date(txDate.getFullYear(), txDate.getMonth(), statementDay), 1);
    }
    
    const key = format(periodStart, "yyyy-MM");
    const startStr = format(periodStart, "yyyy-MM-dd");
    const endStr = format(addMonths(periodStart, 1), "yyyy-MM-dd");
    
    if (!periods.has(key)) {
      periods.set(key, {
        label: format(periodStart, "MMMM yyyy"),
        startDate: startStr,
        endDate: endStr,
        transactions: [],
        total: 0,
      });
    }
    
    const period = periods.get(key)!;
    period.transactions.push(t);
    period.total += parseFloat(t.amount);
  });

  return Array.from(periods.values()).sort(
    (a, b) => new Date(b.startDate).getTime() - new Date(a.startDate).getTime()
  );
}

function AccountCard({ account, onEdit }: { account: Account; onEdit: () => void }) {
  const balance = parseFloat(account.balance);
  const isDebt = account.category === "credit_card" || account.category === "loan";

  return (
    <Card className="hover-elevate cursor-pointer" data-testid={`card-business-account-${account.id}`}>
      <CardContent className="p-4">
        <div className="flex items-start justify-between gap-2">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-chart-4/20">
              {getCategoryIcon(account.category)}
            </div>
            <div className="flex flex-col">
              <span className="font-medium text-sm">{account.name}</span>
              <span className="text-xs text-muted-foreground capitalize">
                {account.category.replace("_", " ")}
              </span>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {account.creditScore && (
              <Badge variant="outline" className="text-xs">
                {account.creditScore}
              </Badge>
            )}
            <Button
              size="icon"
              variant="ghost"
              onClick={(e) => {
                e.stopPropagation();
                onEdit();
              }}
              data-testid={`button-edit-business-account-${account.id}`}
            >
              <Settings className="h-4 w-4" />
            </Button>
          </div>
        </div>
        <div className="mt-4 flex items-end justify-between">
          <div>
            <span className="text-xs text-muted-foreground">
              {isDebt ? "Balance Owed" : "Balance"}
            </span>
            <p
              className={`text-xl font-bold font-mono tabular-nums ${
                isDebt && balance > 0 ? "text-red-500" : ""
              }`}
            >
              {formatCurrency(balance)}
            </p>
          </div>
          {account.creditLimit && (
            <div className="text-right">
              <span className="text-xs text-muted-foreground">Credit Limit</span>
              <p className="text-sm font-mono tabular-nums">
                {formatCurrency(account.creditLimit)}
              </p>
            </div>
          )}
        </div>
        {account.statementDay && (
          <p className="mt-2 text-xs text-muted-foreground">
            Statement starts on day {account.statementDay}
          </p>
        )}
      </CardContent>
    </Card>
  );
}

export default function BusinessFinances() {
  const [accountDialogOpen, setAccountDialogOpen] = useState(false);
  const [editingAccount, setEditingAccount] = useState<Account | null>(null);
  const [importDialogOpen, setImportDialogOpen] = useState(false);
  const [expandedPeriods, setExpandedPeriods] = useState<Set<string>>(new Set());
  const [deleteConfirm, setDeleteConfirm] = useState<{ period: StatementPeriod; accountId: number } | null>(null);
  const { toast } = useToast();

  const { data: accounts, isLoading: accountsLoading } = useQuery<Account[]>({
    queryKey: ["/api/accounts"],
  });

  const { data: transactions, isLoading: transactionsLoading } = useQuery<Transaction[]>({
    queryKey: ["/api/transactions"],
  });

  const businessAccounts = accounts?.filter((a) => a.type === "business") || [];
  const businessTransactions = transactions?.filter((t) =>
    businessAccounts.some((a) => a.id === t.accountId)
  ) || [];

  const totalBalance = businessAccounts.reduce(
    (sum, a) => sum + parseFloat(a.balance),
    0
  );

  const accountForm = useForm({
    resolver: zodResolver(accountFormSchema),
    defaultValues: {
      name: "",
      category: "",
      balance: "0",
      creditLimit: "",
      creditScore: "",
      interestRate: "",
      dueDay: "",
      statementDay: "1",
    },
  });

  const createAccountMutation = useMutation({
    mutationFn: async (data: z.infer<typeof accountFormSchema>) => {
      return apiRequest("POST", "/api/accounts", {
        ...data,
        type: "business",
        balance: data.balance || "0",
        creditLimit: data.creditLimit || null,
        creditScore: data.creditScore ? parseInt(data.creditScore) : null,
        interestRate: data.interestRate || null,
        dueDay: data.dueDay ? parseInt(data.dueDay) : null,
        statementDay: data.statementDay ? parseInt(data.statementDay) : 1,
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/accounts"] });
      setAccountDialogOpen(false);
      accountForm.reset();
      toast({ title: "Account created successfully" });
    },
    onError: () => {
      toast({ title: "Failed to create account", variant: "destructive" });
    },
  });

  const updateAccountMutation = useMutation({
    mutationFn: async ({ id, data }: { id: number; data: z.infer<typeof accountFormSchema> }) => {
      return apiRequest("PATCH", `/api/accounts/${id}`, {
        ...data,
        creditLimit: data.creditLimit || null,
        creditScore: data.creditScore ? parseInt(data.creditScore) : null,
        interestRate: data.interestRate || null,
        dueDay: data.dueDay ? parseInt(data.dueDay) : null,
        statementDay: data.statementDay ? parseInt(data.statementDay) : 1,
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/accounts"] });
      setEditingAccount(null);
      accountForm.reset();
      toast({ title: "Account updated successfully" });
    },
    onError: () => {
      toast({ title: "Failed to update account", variant: "destructive" });
    },
  });

  const deleteStatementMutation = useMutation({
    mutationFn: async ({ accountId, startDate, endDate }: { accountId: number; startDate: string; endDate: string }) => {
      return apiRequest("DELETE", "/api/transactions/by-date-range", {
        accountId,
        startDate,
        endDate,
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/transactions"] });
      setDeleteConfirm(null);
      toast({ title: "Statement transactions deleted" });
    },
    onError: () => {
      toast({ title: "Failed to delete transactions", variant: "destructive" });
    },
  });

  const handleEditAccount = (account: Account) => {
    setEditingAccount(account);
    accountForm.reset({
      name: account.name,
      category: account.category,
      balance: account.balance,
      creditLimit: account.creditLimit || "",
      creditScore: account.creditScore?.toString() || "",
      interestRate: account.interestRate || "",
      dueDay: account.dueDay?.toString() || "",
      statementDay: account.statementDay?.toString() || "1",
    });
  };

  const togglePeriod = (key: string) => {
    setExpandedPeriods((prev) => {
      const next = new Set(prev);
      if (next.has(key)) {
        next.delete(key);
      } else {
        next.add(key);
      }
      return next;
    });
  };

  const transactionsByAccount = businessAccounts.map((account) => {
    const accountTransactions = businessTransactions.filter((t) => t.accountId === account.id);
    const periods = getStatementPeriods(accountTransactions, account.statementDay || 1);
    return { account, periods };
  });

  return (
    <div className="flex flex-col gap-6 p-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold">Business Finances</h1>
          <p className="text-muted-foreground">
            Manage your business accounts and import statements
          </p>
        </div>
        <div className="flex gap-2">
          <Dialog open={accountDialogOpen} onOpenChange={setAccountDialogOpen}>
            <DialogTrigger asChild>
              <Button data-testid="button-add-business-account">
                <Plus className="h-4 w-4 mr-2" />
                Add Account
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Add Business Account</DialogTitle>
                <DialogDescription>
                  Create a new business account to track your finances
                </DialogDescription>
              </DialogHeader>
              <Form {...accountForm}>
                <form
                  onSubmit={accountForm.handleSubmit((data) =>
                    createAccountMutation.mutate(data)
                  )}
                  className="space-y-4"
                >
                  <FormField
                    control={accountForm.control}
                    name="name"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Account Name</FormLabel>
                        <FormControl>
                          <Input
                            placeholder="e.g., Business Checking"
                            {...field}
                            data-testid="input-business-account-name"
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={accountForm.control}
                    name="category"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Category</FormLabel>
                        <Select onValueChange={field.onChange} value={field.value}>
                          <FormControl>
                            <SelectTrigger data-testid="select-business-category">
                              <SelectValue placeholder="Select category" />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            <SelectItem value="checking">Business Checking</SelectItem>
                            <SelectItem value="savings">Business Savings</SelectItem>
                            <SelectItem value="credit_card">Business Credit Card</SelectItem>
                            <SelectItem value="loan">Business Loan</SelectItem>
                            <SelectItem value="investment">Business Investment</SelectItem>
                          </SelectContent>
                        </Select>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <div className="grid grid-cols-2 gap-4">
                    <FormField
                      control={accountForm.control}
                      name="balance"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Starting Balance</FormLabel>
                          <FormControl>
                            <Input
                              type="number"
                              step="0.01"
                              placeholder="0.00"
                              {...field}
                              data-testid="input-business-balance"
                            />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={accountForm.control}
                      name="statementDay"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Statement Day</FormLabel>
                          <FormControl>
                            <Input
                              type="number"
                              min="1"
                              max="31"
                              placeholder="1"
                              {...field}
                              data-testid="input-business-statement-day"
                            />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <FormField
                      control={accountForm.control}
                      name="creditScore"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Credit Score (optional)</FormLabel>
                          <FormControl>
                            <Input
                              type="number"
                              placeholder="750"
                              {...field}
                              data-testid="input-business-credit-score"
                            />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={accountForm.control}
                      name="creditLimit"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Credit Limit (optional)</FormLabel>
                          <FormControl>
                            <Input
                              type="number"
                              step="0.01"
                              placeholder="10000.00"
                              {...field}
                              data-testid="input-business-credit-limit"
                            />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </div>
                  <Button
                    type="submit"
                    className="w-full"
                    disabled={createAccountMutation.isPending}
                    data-testid="button-submit-business-account"
                  >
                    {createAccountMutation.isPending ? "Creating..." : "Create Account"}
                  </Button>
                </form>
              </Form>
            </DialogContent>
          </Dialog>

          <Button
            variant="outline"
            onClick={() => setImportDialogOpen(true)}
            disabled={businessAccounts.length === 0}
            data-testid="button-import-business-statement"
          >
            <Upload className="h-4 w-4 mr-2" />
            Import Statement
          </Button>

          <CSVImportDialog
            open={importDialogOpen}
            onOpenChange={setImportDialogOpen}
            accounts={accounts || []}
            accountType="business"
          />
        </div>
      </div>

      {/* Edit Account Dialog */}
      <Dialog open={!!editingAccount} onOpenChange={(open) => !open && setEditingAccount(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Edit Account Settings</DialogTitle>
            <DialogDescription>
              Update your account settings including statement day
            </DialogDescription>
          </DialogHeader>
          <Form {...accountForm}>
            <form
              onSubmit={accountForm.handleSubmit((data) =>
                editingAccount && updateAccountMutation.mutate({ id: editingAccount.id, data })
              )}
              className="space-y-4"
            >
              <FormField
                control={accountForm.control}
                name="name"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Account Name</FormLabel>
                    <FormControl>
                      <Input {...field} data-testid="input-edit-business-account-name" />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <div className="grid grid-cols-2 gap-4">
                <FormField
                  control={accountForm.control}
                  name="statementDay"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Statement Day</FormLabel>
                      <FormControl>
                        <Input
                          type="number"
                          min="1"
                          max="31"
                          {...field}
                          data-testid="input-edit-business-statement-day"
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={accountForm.control}
                  name="creditScore"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Credit Score</FormLabel>
                      <FormControl>
                        <Input type="number" {...field} data-testid="input-edit-business-credit-score" />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <FormField
                  control={accountForm.control}
                  name="creditLimit"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Credit Limit</FormLabel>
                      <FormControl>
                        <Input type="number" step="0.01" {...field} data-testid="input-edit-business-credit-limit" />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={accountForm.control}
                  name="interestRate"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Interest Rate %</FormLabel>
                      <FormControl>
                        <Input type="number" step="0.01" {...field} data-testid="input-edit-business-interest-rate" />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>
              <Button
                type="submit"
                className="w-full"
                disabled={updateAccountMutation.isPending}
                data-testid="button-update-business-account"
              >
                {updateAccountMutation.isPending ? "Saving..." : "Save Changes"}
              </Button>
            </form>
          </Form>
        </DialogContent>
      </Dialog>

      {/* Delete Statement Confirmation */}
      <AlertDialog open={!!deleteConfirm} onOpenChange={(open) => !open && setDeleteConfirm(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Statement Transactions?</AlertDialogTitle>
            <AlertDialogDescription>
              This will permanently delete all {deleteConfirm?.period.transactions.length} transactions
              from the {deleteConfirm?.period.label} statement period. This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={() =>
                deleteConfirm &&
                deleteStatementMutation.mutate({
                  accountId: deleteConfirm.accountId,
                  startDate: deleteConfirm.period.startDate,
                  endDate: deleteConfirm.period.endDate,
                })
              }
            >
              Delete Transactions
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <Card className="bg-chart-4/5">
        <CardContent className="p-6">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div>
              <span className="text-sm text-muted-foreground">Total Business Balance</span>
              <p className="text-3xl font-bold font-mono tabular-nums">
                {formatCurrency(totalBalance)}
              </p>
            </div>
            <div className="flex gap-6">
              <div>
                <span className="text-sm text-muted-foreground">Accounts</span>
                <p className="text-xl font-semibold">{businessAccounts.length}</p>
              </div>
              <div>
                <span className="text-sm text-muted-foreground">Transactions</span>
                <p className="text-xl font-semibold">{businessTransactions.length}</p>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      <div>
        <h2 className="text-lg font-semibold mb-4">Accounts</h2>
        {accountsLoading ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {[...Array(3)].map((_, i) => (
              <Skeleton key={i} className="h-[160px]" />
            ))}
          </div>
        ) : businessAccounts.length > 0 ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {businessAccounts.map((account) => (
              <AccountCard
                key={account.id}
                account={account}
                onEdit={() => handleEditAccount(account)}
              />
            ))}
          </div>
        ) : (
          <Card>
            <CardContent className="flex flex-col items-center justify-center py-12">
              <Briefcase className="h-12 w-12 text-muted-foreground mb-4" />
              <p className="text-muted-foreground mb-2">No business accounts yet</p>
              <p className="text-sm text-muted-foreground mb-4">
                Add an account to start importing your business statements
              </p>
              <Button
                variant="outline"
                onClick={() => setAccountDialogOpen(true)}
                data-testid="button-add-first-business-account"
              >
                <Plus className="h-4 w-4 mr-2" />
                Add your first account
              </Button>
            </CardContent>
          </Card>
        )}
      </div>

      <div>
        <h2 className="text-lg font-semibold mb-4">Transactions by Statement</h2>
        {transactionsLoading ? (
          <Skeleton className="h-[300px]" />
        ) : transactionsByAccount.some((a) => a.periods.length > 0) ? (
          <div className="space-y-6">
            {transactionsByAccount
              .filter((a) => a.periods.length > 0)
              .map(({ account, periods }) => (
                <Card key={account.id}>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-base flex items-center gap-2">
                      {getCategoryIcon(account.category)}
                      {account.name}
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-2">
                    {periods.map((period) => {
                      const key = `${account.id}-${period.startDate}`;
                      const isExpanded = expandedPeriods.has(key);

                      return (
                        <Collapsible key={key} open={isExpanded} onOpenChange={() => togglePeriod(key)}>
                          <div className="flex items-center justify-between p-3 bg-muted/50 rounded-lg">
                            <CollapsibleTrigger asChild>
                              <Button variant="ghost" className="flex items-center gap-2 p-0 h-auto hover:bg-transparent">
                                {isExpanded ? (
                                  <ChevronDown className="h-4 w-4" />
                                ) : (
                                  <ChevronRight className="h-4 w-4" />
                                )}
                                <span className="font-medium">{period.label}</span>
                                <Badge variant="secondary" className="ml-2">
                                  {period.transactions.length} transactions
                                </Badge>
                              </Button>
                            </CollapsibleTrigger>
                            <div className="flex items-center gap-3">
                              <span
                                className={`font-mono text-sm font-medium ${
                                  period.total < 0 ? "text-red-500" : "text-green-500"
                                }`}
                              >
                                {period.total < 0 ? "-" : "+"}
                                {formatCurrency(Math.abs(period.total))}
                              </span>
                              <Button
                                size="icon"
                                variant="ghost"
                                className="text-destructive hover:text-destructive"
                                onClick={() => setDeleteConfirm({ period, accountId: account.id })}
                                data-testid={`button-delete-business-statement-${key}`}
                              >
                                <Trash2 className="h-4 w-4" />
                              </Button>
                            </div>
                          </div>
                          <CollapsibleContent>
                            <Table>
                              <TableHeader>
                                <TableRow>
                                  <TableHead>Date</TableHead>
                                  <TableHead>Description</TableHead>
                                  <TableHead>Category</TableHead>
                                  <TableHead className="text-right">Amount</TableHead>
                                </TableRow>
                              </TableHeader>
                              <TableBody>
                                {period.transactions.map((transaction) => {
                                  const amount = parseFloat(transaction.amount);
                                  const isExpense = amount < 0;

                                  return (
                                    <TableRow key={transaction.id}>
                                      <TableCell className="text-muted-foreground">
                                        {format(parseISO(transaction.date), "MMM d")}
                                      </TableCell>
                                      <TableCell className="font-medium max-w-[200px] truncate">
                                        {transaction.description}
                                      </TableCell>
                                      <TableCell>
                                        <Badge variant="secondary" className="text-xs">
                                          {transaction.subcategory || transaction.category}
                                        </Badge>
                                      </TableCell>
                                      <TableCell className="text-right">
                                        <span
                                          className={`font-mono tabular-nums font-medium flex items-center justify-end gap-1 ${
                                            isExpense ? "text-red-500" : "text-green-500"
                                          }`}
                                        >
                                          {isExpense ? (
                                            <ArrowDownRight className="h-3 w-3" />
                                          ) : (
                                            <ArrowUpRight className="h-3 w-3" />
                                          )}
                                          {formatCurrency(Math.abs(amount))}
                                        </span>
                                      </TableCell>
                                    </TableRow>
                                  );
                                })}
                              </TableBody>
                            </Table>
                          </CollapsibleContent>
                        </Collapsible>
                      );
                    })}
                  </CardContent>
                </Card>
              ))}
          </div>
        ) : (
          <Card>
            <CardContent className="flex flex-col items-center justify-center py-12">
              <CreditCard className="h-12 w-12 text-muted-foreground mb-4" />
              <p className="text-muted-foreground mb-2">No transactions yet</p>
              <p className="text-sm text-muted-foreground mb-4">
                Import a business bank or credit card statement to see your transactions
              </p>
              <Button
                variant="outline"
                onClick={() => setImportDialogOpen(true)}
                disabled={businessAccounts.length === 0}
                data-testid="button-import-first-business-statement"
              >
                <Upload className="h-4 w-4 mr-2" />
                Import Statement
              </Button>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}
