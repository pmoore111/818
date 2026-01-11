import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
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
import {
  Plus,
  ChevronLeft,
  ChevronRight,
  CalendarDays,
  User,
  Briefcase,
  Check,
  Clock,
  AlertCircle,
  Settings,
  ExternalLink,
} from "lucide-react";
import {
  format,
  startOfMonth,
  endOfMonth,
  eachDayOfInterval,
  isSameMonth,
  isSameDay,
  addMonths,
  subMonths,
  parseISO,
  isAfter,
  isBefore,
  addDays,
} from "date-fns";
import type { Obligation, Account } from "@shared/schema";

function formatCurrency(value: string | number): string {
  const num = typeof value === "string" ? parseFloat(value) : value;
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
  }).format(num);
}

const obligationFormSchema = z.object({
  name: z.string().min(1, "Name is required"),
  amount: z.string().min(1, "Amount is required"),
  type: z.string().min(1, "Type is required"),
  category: z.string().min(1, "Category is required"),
  dueDate: z.string().min(1, "Due date is required"),
  isRecurring: z.boolean().default(false),
  frequency: z.string().optional(),
  accountId: z.string().optional(),
  websiteUrl: z.string().url("Must be a valid URL").or(z.literal("")).optional(),
  notes: z.string().optional(),
}).refine((data) => {
  if (data.category === "credit_payment" && (!data.accountId || data.accountId === "")) {
    return false;
  }
  return true;
}, {
  message: "Credit card payment must be linked to a credit card account",
  path: ["accountId"],
});

export default function Calendar() {
  const [currentMonth, setCurrentMonth] = useState(new Date());
  const [selectedDate, setSelectedDate] = useState<Date | null>(null);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingObligation, setEditingObligation] = useState<Obligation | null>(null);
  const [filter, setFilter] = useState<"all" | "personal" | "business">("all");
  const { toast } = useToast();

  const { data: obligations, isLoading: obligationsLoading } = useQuery<Obligation[]>({
    queryKey: ["/api/obligations"],
  });

  const { data: accounts } = useQuery<Account[]>({
    queryKey: ["/api/accounts"],
  });

  const form = useForm({
    resolver: zodResolver(obligationFormSchema),
    defaultValues: {
      name: "",
      amount: "",
      type: "personal",
      category: "subscription",
      dueDate: format(new Date(), "yyyy-MM-dd"),
      isRecurring: false,
      frequency: "",
      accountId: "",
      websiteUrl: "",
      notes: "",
    },
  });

  const watchCategory = form.watch("category");
  const watchType = form.watch("type");
  const watchAccountId = form.watch("accountId");

  const selectedAccount = accounts?.find(a => a.id.toString() === watchAccountId);
  const creditCardAccounts = accounts?.filter(a => 
    a.category === "credit_card" && a.type === watchType
  ) || [];

  const createMutation = useMutation({
    mutationFn: async (data: z.infer<typeof obligationFormSchema>) => {
      const payload = {
        ...data,
        accountId: data.accountId ? parseInt(data.accountId) : null,
        frequency: data.frequency || null,
        websiteUrl: data.websiteUrl || null,
        notes: data.notes || null,
      };
      if (editingObligation) {
        return apiRequest("PATCH", `/api/obligations/${editingObligation.id}`, payload);
      }
      return apiRequest("POST", "/api/obligations", payload);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/obligations"] });
      setDialogOpen(false);
      setEditingObligation(null);
      form.reset();
      toast({ title: editingObligation ? "Obligation updated" : "Obligation created" });
    },
    onError: () => {
      toast({ title: editingObligation ? "Failed to update obligation" : "Failed to create obligation", variant: "destructive" });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: number) => {
      return apiRequest("DELETE", `/api/obligations/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/obligations"] });
      toast({ title: "Obligation deleted" });
    },
    onError: () => {
      toast({ title: "Failed to delete obligation", variant: "destructive" });
    },
  });

  const handleEdit = (obligation: Obligation) => {
    setEditingObligation(obligation);
    form.reset({
      name: obligation.name,
      amount: obligation.amount.toString(),
      type: obligation.type,
      category: obligation.category || "subscription",
      dueDate: obligation.dueDate,
      isRecurring: obligation.isRecurring || false,
      frequency: obligation.frequency || "",
      accountId: obligation.accountId?.toString() || "",
      websiteUrl: obligation.websiteUrl || "",
      notes: obligation.notes || "",
    });
    setDialogOpen(true);
  };

  const togglePaidMutation = useMutation({
    mutationFn: async ({ id, isPaid }: { id: number; isPaid: boolean }) => {
      return apiRequest("PATCH", `/api/obligations/${id}`, { isPaid });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/obligations"] });
      toast({ title: "Status updated" });
    },
    onError: () => {
      toast({ title: "Failed to update status", variant: "destructive" });
    },
  });

  const filteredObligations =
    obligations?.filter((o) => {
      if (filter === "all") return true;
      return o.type === filter;
    }) || [];

  const monthStart = startOfMonth(currentMonth);
  const monthEnd = endOfMonth(currentMonth);
  const monthDays = eachDayOfInterval({ start: monthStart, end: monthEnd });

  const startDayOffset = monthStart.getDay();
  const paddedDays = [...Array(startDayOffset).fill(null), ...monthDays];

  const getObligationsForDate = (date: Date) => {
    return filteredObligations.filter((o) =>
      isSameDay(parseISO(o.dueDate), date)
    );
  };

  const selectedDateObligations = selectedDate
    ? getObligationsForDate(selectedDate)
    : [];

  const upcomingObligations = filteredObligations
    .filter((o) => !o.isPaid && isAfter(parseISO(o.dueDate), new Date()))
    .sort((a, b) => parseISO(a.dueDate).getTime() - parseISO(b.dueDate).getTime())
    .slice(0, 5);

  const overdueObligations = filteredObligations.filter(
    (o) => !o.isPaid && isBefore(parseISO(o.dueDate), new Date())
  );

  return (
    <div className="flex flex-col lg:flex-row gap-6 p-6 h-full">
      <div className="flex-1 flex flex-col gap-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl font-semibold">Calendar</h1>
            <p className="text-muted-foreground">
              Track your financial obligations and due dates
            </p>
          </div>
          <div className="flex gap-2">
            <Select
              value={filter}
              onValueChange={(v) => setFilter(v as "all" | "personal" | "business")}
            >
              <SelectTrigger className="w-[140px]" data-testid="select-calendar-filter">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All</SelectItem>
                <SelectItem value="personal">Personal</SelectItem>
                <SelectItem value="business">Business</SelectItem>
              </SelectContent>
            </Select>
            <Dialog open={dialogOpen} onOpenChange={(open) => {
              setDialogOpen(open);
              if (!open) {
                setEditingObligation(null);
                form.reset();
              }
            }}>
              <DialogTrigger asChild>
                <Button data-testid="button-add-obligation">
                  <Plus className="h-4 w-4 mr-2" />
                  Add Obligation
                </Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>{editingObligation ? "Edit Obligation" : "Add Obligation"}</DialogTitle>
                </DialogHeader>
                <Form {...form}>
                  <form
                    onSubmit={form.handleSubmit((data) => createMutation.mutate(data))}
                    className="space-y-4"
                  >
                    <FormField
                      control={form.control}
                      name="name"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Name</FormLabel>
                          <FormControl>
                            <Input
                              placeholder="e.g., Rent Payment"
                              {...field}
                              data-testid="input-obligation-name"
                            />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <div className="grid grid-cols-2 gap-4">
                      <FormField
                        control={form.control}
                        name="type"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Type</FormLabel>
                            <Select onValueChange={(v) => {
                              field.onChange(v);
                              form.setValue("accountId", "");
                            }} value={field.value}>
                              <FormControl>
                                <SelectTrigger data-testid="select-obligation-type">
                                  <SelectValue />
                                </SelectTrigger>
                              </FormControl>
                              <SelectContent>
                                <SelectItem value="personal">Personal</SelectItem>
                                <SelectItem value="business">Business</SelectItem>
                              </SelectContent>
                            </Select>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                      <FormField
                        control={form.control}
                        name="category"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Category</FormLabel>
                            <Select onValueChange={(v) => {
                              field.onChange(v);
                              if (v !== "credit_payment") {
                                form.setValue("accountId", "");
                              }
                            }} value={field.value}>
                              <FormControl>
                                <SelectTrigger data-testid="select-obligation-category">
                                  <SelectValue />
                                </SelectTrigger>
                              </FormControl>
                              <SelectContent>
                                <SelectItem value="credit_payment">Credit Card Payment</SelectItem>
                                <SelectItem value="subscription">Subscription</SelectItem>
                                <SelectItem value="bill">Bill</SelectItem>
                              </SelectContent>
                            </Select>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                    </div>

                    {watchCategory === "credit_payment" && (
                      <>
                        <FormField
                          control={form.control}
                          name="accountId"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel>Link to Credit Card</FormLabel>
                              <Select onValueChange={field.onChange} value={field.value}>
                                <FormControl>
                                  <SelectTrigger data-testid="select-obligation-creditcard">
                                    <SelectValue placeholder="Select credit card" />
                                  </SelectTrigger>
                                </FormControl>
                                <SelectContent>
                                  {creditCardAccounts.length === 0 ? (
                                    <div className="p-2 text-sm text-muted-foreground">
                                      No {watchType} credit cards found
                                    </div>
                                  ) : (
                                    creditCardAccounts.map((account) => (
                                      <SelectItem
                                        key={account.id}
                                        value={account.id.toString()}
                                      >
                                        {account.name}
                                      </SelectItem>
                                    ))
                                  )}
                                </SelectContent>
                              </Select>
                              <FormMessage />
                            </FormItem>
                          )}
                        />
                        {selectedAccount && (
                          <Card className="bg-muted/50">
                            <CardContent className="p-4 space-y-2">
                              <div className="flex justify-between text-sm">
                                <span className="text-muted-foreground">Credit Limit</span>
                                <span className="font-mono tabular-nums">
                                  {selectedAccount.creditLimit ? formatCurrency(selectedAccount.creditLimit) : "N/A"}
                                </span>
                              </div>
                              <div className="flex justify-between text-sm">
                                <span className="text-muted-foreground">Current Balance</span>
                                <span className="font-mono tabular-nums">
                                  {formatCurrency(selectedAccount.balance)}
                                </span>
                              </div>
                              {selectedAccount.creditLimit && (
                                <div className="flex justify-between text-sm">
                                  <span className="text-muted-foreground">Available Credit</span>
                                  <span className="font-mono tabular-nums">
                                    {formatCurrency(parseFloat(selectedAccount.creditLimit) - parseFloat(selectedAccount.balance))}
                                  </span>
                                </div>
                              )}
                            </CardContent>
                          </Card>
                        )}
                      </>
                    )}

                    <div className="grid grid-cols-2 gap-4">
                      <FormField
                        control={form.control}
                        name="amount"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>{watchCategory === "credit_payment" ? "Payment Amount" : "Amount"}</FormLabel>
                            <FormControl>
                              <Input
                                type="number"
                                step="0.01"
                                placeholder="0.00"
                                {...field}
                                data-testid="input-obligation-amount"
                              />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                      <FormField
                        control={form.control}
                        name="dueDate"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Due Date</FormLabel>
                            <FormControl>
                              <Input
                                type="date"
                                {...field}
                                data-testid="input-obligation-date"
                              />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                    </div>
                    <FormField
                      control={form.control}
                      name="websiteUrl"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Website Link (optional)</FormLabel>
                          <FormControl>
                            <Input
                              placeholder="https://..."
                              {...field}
                              data-testid="input-obligation-website"
                            />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={form.control}
                      name="isRecurring"
                      render={({ field }) => (
                        <FormItem className="flex items-center justify-between rounded-lg border p-3">
                          <div>
                            <FormLabel className="text-base">Recurring</FormLabel>
                            <p className="text-sm text-muted-foreground">
                              This obligation repeats regularly
                            </p>
                          </div>
                          <FormControl>
                            <Switch
                              checked={field.value}
                              onCheckedChange={field.onChange}
                              data-testid="switch-recurring"
                            />
                          </FormControl>
                        </FormItem>
                      )}
                    />
                    {form.watch("isRecurring") && (
                      <FormField
                        control={form.control}
                        name="frequency"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Frequency</FormLabel>
                            <Select onValueChange={field.onChange} value={field.value}>
                              <FormControl>
                                <SelectTrigger data-testid="select-frequency">
                                  <SelectValue placeholder="Select frequency" />
                                </SelectTrigger>
                              </FormControl>
                              <SelectContent>
                                <SelectItem value="weekly">Weekly</SelectItem>
                                <SelectItem value="monthly">Monthly</SelectItem>
                                <SelectItem value="yearly">Yearly</SelectItem>
                              </SelectContent>
                            </Select>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                    )}
                    <FormField
                      control={form.control}
                      name="notes"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Notes (optional)</FormLabel>
                          <FormControl>
                            <Textarea
                              placeholder="Additional notes..."
                              {...field}
                              data-testid="input-obligation-notes"
                            />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <div className="flex gap-2">
                      <Button
                        type="submit"
                        className="flex-1"
                        disabled={createMutation.isPending}
                        data-testid="button-submit-obligation"
                      >
                        {createMutation.isPending ? "Saving..." : editingObligation ? "Update Obligation" : "Create Obligation"}
                      </Button>
                      {editingObligation && (
                        <Button
                          type="button"
                          variant="destructive"
                          onClick={() => {
                            if (confirm("Are you sure you want to delete this obligation?")) {
                              deleteMutation.mutate(editingObligation.id);
                              setDialogOpen(false);
                            }
                          }}
                          disabled={deleteMutation.isPending}
                        >
                          Delete
                        </Button>
                      )}
                    </div>
                  </form>
                </Form>
              </DialogContent>
            </Dialog>
          </div>
        </div>

        {overdueObligations.length > 0 && (
          <Card className="border-red-500/50 bg-red-500/5">
            <CardContent className="p-4">
              <div className="flex items-center gap-2 text-red-500">
                <AlertCircle className="h-4 w-4" />
                <span className="font-medium text-sm">
                  {overdueObligations.length} overdue obligation
                  {overdueObligations.length > 1 ? "s" : ""}
                </span>
              </div>
            </CardContent>
          </Card>
        )}

        <Card>
          <CardHeader className="pb-2">
            <div className="flex items-center justify-between">
              <CardTitle className="text-lg font-semibold">
                {format(currentMonth, "MMMM yyyy")}
              </CardTitle>
              <div className="flex gap-1">
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => setCurrentMonth(subMonths(currentMonth, 1))}
                  data-testid="button-prev-month"
                >
                  <ChevronLeft className="h-4 w-4" />
                </Button>
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => setCurrentMonth(addMonths(currentMonth, 1))}
                  data-testid="button-next-month"
                >
                  <ChevronRight className="h-4 w-4" />
                </Button>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            {obligationsLoading ? (
              <Skeleton className="h-[400px]" />
            ) : (
              <>
                <div className="grid grid-cols-7 gap-px mb-2">
                  {["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].map((day) => (
                    <div
                      key={day}
                      className="text-center text-xs font-medium text-muted-foreground py-2"
                    >
                      {day}
                    </div>
                  ))}
                </div>
                <div className="grid grid-cols-7 gap-px bg-border rounded-lg overflow-hidden">
                  {paddedDays.map((day, i) => {
                    if (!day) {
                      return <div key={`empty-${i}`} className="bg-background p-2 min-h-[80px]" />;
                    }

                    const dayObligations = getObligationsForDate(day);
                    const hasPersonal = dayObligations.some((o) => o.type === "personal");
                    const hasBusiness = dayObligations.some((o) => o.type === "business");
                    const hasOverdue = dayObligations.some(
                      (o) => !o.isPaid && isBefore(parseISO(o.dueDate), new Date())
                    );
                    const isSelected = selectedDate && isSameDay(day, selectedDate);
                    const isToday = isSameDay(day, new Date());

                    return (
                      <button
                        key={day.toISOString()}
                        onClick={() => setSelectedDate(day)}
                        className={`bg-background p-2 min-h-[80px] text-left transition-colors hover-elevate ${
                          isSelected ? "ring-2 ring-primary ring-inset" : ""
                        } ${!isSameMonth(day, currentMonth) ? "text-muted-foreground" : ""}`}
                        data-testid={`calendar-day-${format(day, "yyyy-MM-dd")}`}
                      >
                        <div className="flex items-center justify-between mb-1">
                          <span
                            className={`text-sm font-medium ${
                              isToday
                                ? "bg-primary text-primary-foreground w-6 h-6 rounded-full flex items-center justify-center"
                                : ""
                            }`}
                          >
                            {format(day, "d")}
                          </span>
                          {dayObligations.length > 0 && (
                            <div className="flex gap-0.5">
                              {hasPersonal && (
                                <div className="w-2 h-2 rounded-full bg-chart-2" />
                              )}
                              {hasBusiness && (
                                <div className="w-2 h-2 rounded-full bg-chart-4" />
                              )}
                              {hasOverdue && (
                                <div className="w-2 h-2 rounded-full bg-red-500" />
                              )}
                            </div>
                          )}
                        </div>
                        {dayObligations.slice(0, 2).map((o) => (
                          <div
                            key={o.id}
                            className={`text-xs truncate mb-0.5 px-1 rounded ${
                              o.isPaid
                                ? "bg-muted text-muted-foreground line-through"
                                : o.type === "personal"
                                ? "bg-chart-2/20 text-chart-2"
                                : "bg-chart-4/20 text-chart-4"
                            }`}
                          >
                            {o.name}
                          </div>
                        ))}
                        {dayObligations.length > 2 && (
                          <span className="text-xs text-muted-foreground">
                            +{dayObligations.length - 2} more
                          </span>
                        )}
                      </button>
                    );
                  })}
                </div>
              </>
            )}
          </CardContent>
        </Card>
      </div>

      <div className="w-full lg:w-80 flex flex-col gap-4">
        {selectedDate ? (
          <Card>
            <CardHeader>
              <CardTitle className="text-base font-semibold">
                {format(selectedDate, "MMMM d, yyyy")}
              </CardTitle>
            </CardHeader>
            <CardContent>
              {selectedDateObligations.length > 0 ? (
                <div className="space-y-3">
                  {selectedDateObligations.map((obligation) => (
                    <div
                      key={obligation.id}
                      className="flex items-start gap-3 p-3 rounded-lg border"
                      data-testid={`obligation-detail-${obligation.id}`}
                    >
                      <Checkbox
                        checked={obligation.isPaid || false}
                        onCheckedChange={(checked) =>
                          togglePaidMutation.mutate({
                            id: obligation.id,
                            isPaid: checked === true,
                          })
                        }
                        data-testid={`checkbox-paid-${obligation.id}`}
                      />
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between gap-2">
                          <div className="flex items-center gap-2">
                            <span
                              className={`font-medium text-sm ${
                                obligation.isPaid ? "line-through text-muted-foreground" : ""
                              }`}
                            >
                              {obligation.name}
                            </span>
                            <Badge
                              variant={obligation.type === "personal" ? "secondary" : "outline"}
                              className="text-xs"
                            >
                              {obligation.type === "personal" ? (
                                <User className="h-3 w-3 mr-1" />
                              ) : (
                                <Briefcase className="h-3 w-3 mr-1" />
                              )}
                              {obligation.type}
                            </Badge>
                          </div>
                          <div className="flex gap-1">
                            {obligation.websiteUrl && (
                              <Button
                                variant="ghost"
                                size="icon"
                                className="h-6 w-6"
                                asChild
                              >
                                <a
                                  href={obligation.websiteUrl}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                >
                                  <ExternalLink className="h-3 w-3" />
                                </a>
                              </Button>
                            )}
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-6 w-6"
                              onClick={() => handleEdit(obligation)}
                            >
                              <Settings className="h-3 w-3" />
                            </Button>
                          </div>
                        </div>
                        <p className="font-mono text-sm tabular-nums mt-1">
                          {formatCurrency(obligation.amount)}
                          {(() => {
                            const linkedAccount = accounts?.find(a => a.id === obligation.accountId);
                            if (linkedAccount && linkedAccount.category === "credit_card") {
                              return (
                                <span className="text-xs text-muted-foreground ml-2">
                                  (Balance: {formatCurrency(linkedAccount.balance)})
                                </span>
                              );
                            }
                            return null;
                          })()}
                        </p>
                        {obligation.notes && (
                          <p className="text-xs text-muted-foreground mt-1">
                            {obligation.notes}
                          </p>
                        )}
                        {obligation.isRecurring && obligation.frequency && (
                          <p className="text-xs text-muted-foreground mt-1">
                            Repeats {obligation.frequency}
                          </p>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-center py-6 text-muted-foreground">
                  <CalendarDays className="h-10 w-10 mx-auto mb-2" />
                  <p className="text-sm">No obligations for this date</p>
                </div>
              )}
            </CardContent>
          </Card>
        ) : (
          <Card>
            <CardHeader>
              <CardTitle className="text-base font-semibold">Select a Date</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-muted-foreground">
                Click on a date to view its obligations
              </p>
            </CardContent>
          </Card>
        )}

        <Card>
          <CardHeader>
            <CardTitle className="text-base font-semibold flex items-center gap-2">
              <Clock className="h-4 w-4" />
              Upcoming
            </CardTitle>
          </CardHeader>
          <CardContent>
            {upcomingObligations.length > 0 ? (
              <div className="space-y-3">
                {upcomingObligations.map((obligation) => (
                  <div
                    key={obligation.id}
                    className="flex items-center justify-between pb-3 border-b last:border-0 last:pb-0"
                  >
                    <div className="flex items-center gap-2">
                      <div
                        className={`w-2 h-2 rounded-full ${
                          obligation.type === "personal" ? "bg-chart-2" : "bg-chart-4"
                        }`}
                      />
                      <div>
                        <p className="text-sm font-medium">{obligation.name}</p>
                        <p className="text-xs text-muted-foreground">
                          {format(parseISO(obligation.dueDate), "MMM d")}
                        </p>
                      </div>
                    </div>
                    <div className="text-right">
                      <span className="font-mono text-sm tabular-nums">
                        {formatCurrency(obligation.amount)}
                      </span>
                      {(() => {
                        const linkedAccount = accounts?.find(a => a.id === obligation.accountId);
                        if (linkedAccount && linkedAccount.category === "credit_card") {
                          return (
                            <p className="text-xs text-muted-foreground font-mono tabular-nums">
                              Bal: {formatCurrency(linkedAccount.balance)}
                            </p>
                          );
                        }
                        return null;
                      })()}
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-sm text-muted-foreground text-center py-4">
                No upcoming obligations
              </p>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-4 text-sm">
              <div className="flex items-center gap-2">
                <div className="w-3 h-3 rounded-full bg-chart-2" />
                <span className="text-muted-foreground">Personal</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="w-3 h-3 rounded-full bg-chart-4" />
                <span className="text-muted-foreground">Business</span>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
