import { useState, useCallback } from "react";
import { useMutation } from "@tanstack/react-query";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Checkbox } from "@/components/ui/checkbox";
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
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";
import {
  Upload,
  FileSpreadsheet,
  ArrowRight,
  Check,
  AlertCircle,
  Loader2,
} from "lucide-react";
import Papa from "papaparse";
import type { Account } from "@shared/schema";

interface CSVImportDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  accounts: Account[];
  accountType: "personal" | "business";
}

type Step = "upload" | "mapping" | "preview" | "complete";

interface ColumnMapping {
  date: string;
  description: string;
  amount: string;
  category?: string;
}

interface ParsedRow {
  date: string;
  description: string;
  amount: number;
  category: string;
  isValid: boolean;
  error?: string;
}

function parseDate(dateStr: string): string | null {
  if (!dateStr) return null;
  
  // Handle ISO datetime format (2026-01-07 11:14:23)
  const isoDateTimeMatch = dateStr.match(/^(\d{4})-(\d{2})-(\d{2})\s/);
  if (isoDateTimeMatch) {
    return `${isoDateTimeMatch[1]}-${isoDateTimeMatch[2]}-${isoDateTimeMatch[3]}`;
  }

  // Handle ISO date format (2026-01-07)
  const isoMatch = dateStr.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (isoMatch) {
    return `${isoMatch[1]}-${isoMatch[2]}-${isoMatch[3]}`;
  }

  // Handle MM/DD/YYYY format
  const mdyMatch = dateStr.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  if (mdyMatch) {
    const month = mdyMatch[1].padStart(2, "0");
    const day = mdyMatch[2].padStart(2, "0");
    const year = mdyMatch[3];
    return `${year}-${month}-${day}`;
  }

  // Try with Date object as fallback
  const parsed = new Date(dateStr);
  if (!isNaN(parsed.getTime())) {
    return parsed.toISOString().split("T")[0];
  }

  return null;
}

function parseAmount(amountStr: string): number | null {
  if (amountStr === undefined || amountStr === null) return null;
  
  const str = String(amountStr).trim();
  if (str === "" || str === "0" || str === "0.0") return 0;
  
  // Remove currency symbols, commas, and whitespace
  const cleaned = str
    .replace(/[$£€¥,\s]/g, "")
    .replace(/\(([^)]+)\)/, "-$1"); // Handle (100.00) as -100.00

  const num = parseFloat(cleaned);
  return isNaN(num) ? null : num;
}

function detectIfHasHeaders(firstRow: string[]): boolean {
  // Check if the first row looks like headers
  const headerPatterns = [
    /timestamp/i, /date/i, /amount/i, /description/i, /merchant/i,
    /transaction/i, /type/i, /status/i, /note/i, /memo/i, /currency/i
  ];
  
  const matchCount = firstRow.filter(cell => 
    headerPatterns.some(pattern => pattern.test(cell))
  ).length;
  
  // If 2+ cells match header patterns, likely has headers
  return matchCount >= 2;
}

function generateColumnNames(count: number): string[] {
  return Array.from({ length: count }, (_, i) => `Column ${i + 1}`);
}

export function CSVImportDialog({
  open,
  onOpenChange,
  accounts,
  accountType,
}: CSVImportDialogProps) {
  const [step, setStep] = useState<Step>("upload");
  const [csvData, setCsvData] = useState<string[][]>([]);
  const [headers, setHeaders] = useState<string[]>([]);
  const [hasHeaders, setHasHeaders] = useState(true);
  const [mapping, setMapping] = useState<ColumnMapping>({
    date: "",
    description: "",
    amount: "",
    category: "",
  });
  const [selectedAccountId, setSelectedAccountId] = useState<string>("");
  const [parsedRows, setParsedRows] = useState<ParsedRow[]>([]);
  const [fileName, setFileName] = useState<string>("");
  const { toast } = useToast();

  const filteredAccounts = accounts.filter((a) => a.type === accountType);

  const resetState = () => {
    setStep("upload");
    setCsvData([]);
    setHeaders([]);
    setHasHeaders(true);
    setMapping({ date: "", description: "", amount: "", category: "" });
    setSelectedAccountId("");
    setParsedRows([]);
    setFileName("");
  };

  const processCSV = useCallback((data: string[][], detectHeaders: boolean) => {
    if (data.length === 0) return;
    
    const firstRow = data[0];
    const detectedHasHeaders = detectHeaders ? detectIfHasHeaders(firstRow) : hasHeaders;
    setHasHeaders(detectedHasHeaders);
    
    let headerRow: string[];
    let dataRows: string[][];
    
    if (detectedHasHeaders) {
      headerRow = firstRow;
      dataRows = data.slice(1);
    } else {
      headerRow = generateColumnNames(firstRow.length);
      dataRows = data;
    }
    
    // Sanitize headers - replace empty strings with column names
    const sanitizedHeaders = headerRow.map((h, i) => 
      h?.trim() ? h.trim() : `Column ${i + 1}`
    );
    
    setHeaders(sanitizedHeaders);
    setCsvData(dataRows.filter((row) => row.some((cell) => cell?.trim())));
    
    // Auto-detect column mappings
    const autoMapping: ColumnMapping = {
      date: "",
      description: "",
      amount: "",
      category: "",
    };
    
    headerRow.forEach((header, index) => {
      const headerLower = header.toLowerCase().trim();
      
      // Date detection
      if (headerLower.includes("date") || headerLower.includes("timestamp") || headerLower.includes("posted")) {
        if (!autoMapping.date) autoMapping.date = header;
      }
      
      // Description detection
      if (headerLower.includes("description") || headerLower.includes("memo") || 
          headerLower.includes("merchant") || headerLower.includes("payee")) {
        if (!autoMapping.description) autoMapping.description = header;
      }
      
      // Amount detection
      if (headerLower.includes("amount") || headerLower.includes("debit") || headerLower.includes("credit")) {
        if (!autoMapping.amount) autoMapping.amount = header;
      }
      
      // Category detection
      if (headerLower.includes("category") || headerLower.includes("type")) {
        if (!autoMapping.category) autoMapping.category = header;
      }
    });
    
    // For headerless CSVs (like Premier Credit Card), try to detect by position/content
    if (!detectedHasHeaders && dataRows.length > 0) {
      const sampleRow = dataRows[0];
      
      sampleRow.forEach((cell, index) => {
        const trimmed = cell?.trim() || "";
        
        // Check if it looks like a date
        if (!autoMapping.date && (parseDate(trimmed) !== null)) {
          autoMapping.date = headerRow[index];
        }
        
        // Check if it looks like a number (amount)
        if (!autoMapping.amount && /^-?\d+\.?\d*$/.test(trimmed.replace(/[$,]/g, ""))) {
          // Skip if it looks like a reference number (long alphanumeric)
          if (!/[A-Za-z]/.test(trimmed)) {
            autoMapping.amount = headerRow[index];
          }
        }
      });
      
      // For Premier format: Date, Reference, Amount, Description
      // The last column is usually description
      if (!autoMapping.description && headerRow.length >= 4) {
        autoMapping.description = headerRow[headerRow.length - 1];
      }
    }
    
    setMapping(autoMapping);
  }, [hasHeaders]);

  const handleFileUpload = useCallback(
    (event: React.ChangeEvent<HTMLInputElement>) => {
      const file = event.target.files?.[0];
      if (!file) return;

      setFileName(file.name);

      Papa.parse(file, {
        complete: (results) => {
          const data = results.data as string[][];
          if (data.length > 0) {
            processCSV(data, true);
            setStep("mapping");
          }
        },
        error: (error) => {
          toast({
            title: "Failed to parse CSV",
            description: error.message,
            variant: "destructive",
          });
        },
      });
    },
    [toast, processCSV]
  );

  const handleHeaderToggle = (checked: boolean) => {
    setHasHeaders(checked);
    // Reprocess with new header setting
    const allData = hasHeaders ? [headers, ...csvData] : csvData;
    
    if (checked) {
      // First row becomes headers - sanitize to prevent empty strings
      const rawHeaders = allData[0] || [];
      const sanitizedHeaders = rawHeaders.map((h, i) => 
        h?.trim() ? h.trim() : `Column ${i + 1}`
      );
      setHeaders(sanitizedHeaders);
      setCsvData(allData.slice(1));
    } else {
      // Generate column names, first row becomes data
      const newHeaders = generateColumnNames(allData[0]?.length || 0);
      setHeaders(newHeaders);
      setCsvData(allData);
    }
    
    // Reset mapping when toggling
    setMapping({ date: "", description: "", amount: "", category: "" });
  };

  const handleMappingComplete = () => {
    if (!mapping.date || !mapping.description || !mapping.amount || !selectedAccountId) {
      toast({
        title: "Missing required fields",
        description: "Please map all required columns and select an account",
        variant: "destructive",
      });
      return;
    }

    const dateIdx = headers.indexOf(mapping.date);
    const descIdx = headers.indexOf(mapping.description);
    const amountIdx = headers.indexOf(mapping.amount);
    const categoryIdx = mapping.category ? headers.indexOf(mapping.category) : -1;

    const parsed: ParsedRow[] = csvData.map((row) => {
      const dateStr = row[dateIdx]?.trim() || "";
      const descStr = row[descIdx]?.trim() || "";
      const amountStr = row[amountIdx]?.trim() || "";
      const categoryStr = categoryIdx >= 0 ? row[categoryIdx]?.trim() : "";

      const date = parseDate(dateStr);
      const amount = parseAmount(amountStr);

      const errors: string[] = [];
      if (!date) errors.push("Invalid date");
      if (!descStr) errors.push("Missing description");
      if (amount === null) errors.push("Invalid amount");

      return {
        date: date || dateStr,
        description: descStr,
        amount: amount || 0,
        category: categoryStr || "Other",
        isValid: errors.length === 0,
        error: errors.length > 0 ? errors.join(", ") : undefined,
      };
    });

    // Filter out zero-amount rows (often authorization holds)
    const filteredParsed = parsed.filter(row => row.amount !== 0 || !row.isValid);
    
    setParsedRows(filteredParsed);
    setStep("preview");
  };

  const importMutation = useMutation({
    mutationFn: async () => {
      const validRows = parsedRows.filter((r) => r.isValid);
      
      const transactions = validRows.map((row) => ({
        accountId: parseInt(selectedAccountId),
        description: row.description,
        amount: row.amount.toString(),
        category: row.amount < 0 ? "expense" : "income",
        subcategory: row.category,
        date: row.date,
      }));

      return apiRequest("POST", "/api/transactions/bulk", { transactions });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/transactions"] });
      queryClient.invalidateQueries({ queryKey: ["/api/accounts"] });
      setStep("complete");
      toast({ title: "Transactions imported successfully" });
    },
    onError: () => {
      toast({ title: "Failed to import transactions", variant: "destructive" });
    },
  });

  const validCount = parsedRows.filter((r) => r.isValid).length;
  const invalidCount = parsedRows.filter((r) => !r.isValid).length;

  return (
    <Dialog
      open={open}
      onOpenChange={(open) => {
        if (!open) resetState();
        onOpenChange(open);
      }}
    >
      <DialogContent className="max-w-4xl max-h-[90vh] flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <FileSpreadsheet className="h-5 w-5" />
            Import {accountType === "personal" ? "Personal" : "Business"} Statement
          </DialogTitle>
          <DialogDescription>
            Upload a CSV file from your bank or credit card statement
          </DialogDescription>
        </DialogHeader>

        <div className="flex items-center gap-2 mb-4">
          {(["upload", "mapping", "preview", "complete"] as Step[]).map((s, i) => (
            <div key={s} className="flex items-center gap-2">
              <div
                className={`flex h-8 w-8 items-center justify-center rounded-full text-sm font-medium ${
                  step === s
                    ? "bg-primary text-primary-foreground"
                    : step === "complete" || (["upload", "mapping", "preview"].indexOf(step) > i)
                    ? "bg-primary/20 text-primary"
                    : "bg-muted text-muted-foreground"
                }`}
              >
                {step === "complete" || (["upload", "mapping", "preview"].indexOf(step) > i) ? (
                  <Check className="h-4 w-4" />
                ) : (
                  i + 1
                )}
              </div>
              <span className="text-sm capitalize hidden sm:inline">{s}</span>
              {i < 3 && <ArrowRight className="h-4 w-4 text-muted-foreground" />}
            </div>
          ))}
        </div>

        {step === "upload" && (
          <div className="flex flex-col items-center justify-center py-12 border-2 border-dashed rounded-lg">
            <Upload className="h-12 w-12 text-muted-foreground mb-4" />
            <p className="text-muted-foreground mb-2">
              Upload a CSV file from your bank or credit card
            </p>
            <p className="text-xs text-muted-foreground mb-4">
              Supports various formats including Lili, Premier, and more
            </p>
            <Label htmlFor="csv-file" className="cursor-pointer">
              <Input
                id="csv-file"
                type="file"
                accept=".csv"
                className="hidden"
                onChange={handleFileUpload}
                data-testid="input-csv-file"
              />
              <Button asChild>
                <span>
                  <Upload className="h-4 w-4 mr-2" />
                  Select CSV File
                </span>
              </Button>
            </Label>
          </div>
        )}

        {step === "mapping" && (
          <div className="space-y-4">
            <div className="flex items-center justify-between gap-2 p-3 bg-muted rounded-lg">
              <div className="flex items-center gap-2">
                <FileSpreadsheet className="h-4 w-4" />
                <span className="text-sm font-medium">{fileName}</span>
                <Badge variant="secondary">{csvData.length} rows</Badge>
              </div>
              <div className="flex items-center gap-2">
                <Checkbox
                  id="has-headers"
                  checked={hasHeaders}
                  onCheckedChange={(checked) => handleHeaderToggle(!!checked)}
                />
                <Label htmlFor="has-headers" className="text-sm cursor-pointer">
                  First row is header
                </Label>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>Account *</Label>
                <Select
                  value={selectedAccountId}
                  onValueChange={setSelectedAccountId}
                >
                  <SelectTrigger data-testid="select-import-account">
                    <SelectValue placeholder="Select account" />
                  </SelectTrigger>
                  <SelectContent>
                    {filteredAccounts.map((account) => (
                      <SelectItem key={account.id} value={account.id.toString()}>
                        {account.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Date Column *</Label>
                <Select
                  value={mapping.date}
                  onValueChange={(v) => setMapping({ ...mapping, date: v })}
                >
                  <SelectTrigger data-testid="select-date-column">
                    <SelectValue placeholder="Select column" />
                  </SelectTrigger>
                  <SelectContent>
                    {headers.map((header) => (
                      <SelectItem key={header} value={header}>
                        {header}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Description Column *</Label>
                <Select
                  value={mapping.description}
                  onValueChange={(v) => setMapping({ ...mapping, description: v })}
                >
                  <SelectTrigger data-testid="select-description-column">
                    <SelectValue placeholder="Select column" />
                  </SelectTrigger>
                  <SelectContent>
                    {headers.map((header) => (
                      <SelectItem key={header} value={header}>
                        {header}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Amount Column *</Label>
                <Select
                  value={mapping.amount}
                  onValueChange={(v) => setMapping({ ...mapping, amount: v })}
                >
                  <SelectTrigger data-testid="select-amount-column">
                    <SelectValue placeholder="Select column" />
                  </SelectTrigger>
                  <SelectContent>
                    {headers.map((header) => (
                      <SelectItem key={header} value={header}>
                        {header}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Category Column (optional)</Label>
                <Select
                  value={mapping.category || "__none__"}
                  onValueChange={(v) => setMapping({ ...mapping, category: v === "__none__" ? "" : v })}
                >
                  <SelectTrigger data-testid="select-category-column">
                    <SelectValue placeholder="Select column" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="__none__">None</SelectItem>
                    {headers.map((header) => (
                      <SelectItem key={header} value={header}>
                        {header}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="p-3 bg-muted/50 rounded-lg">
              <p className="text-sm font-medium mb-2">Sample Data Preview</p>
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      {headers.slice(0, 6).map((header, i) => (
                        <TableHead key={i} className="text-xs">
                          {header}
                        </TableHead>
                      ))}
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {csvData.slice(0, 3).map((row, i) => (
                      <TableRow key={i}>
                        {row.slice(0, 6).map((cell, j) => (
                          <TableCell key={j} className="text-xs">
                            {cell?.substring(0, 30)}
                          </TableCell>
                        ))}
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </div>

            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={() => setStep("upload")}>
                Back
              </Button>
              <Button
                onClick={handleMappingComplete}
                disabled={!mapping.date || !mapping.description || !mapping.amount || !selectedAccountId}
                data-testid="button-continue-mapping"
              >
                Continue
                <ArrowRight className="h-4 w-4 ml-2" />
              </Button>
            </div>
          </div>
        )}

        {step === "preview" && (
          <div className="flex flex-col flex-1 min-h-0">
            <div className="flex items-center gap-4 mb-4">
              <Badge variant="default" className="gap-1">
                <Check className="h-3 w-3" />
                {validCount} valid
              </Badge>
              {invalidCount > 0 && (
                <Badge variant="destructive" className="gap-1">
                  <AlertCircle className="h-3 w-3" />
                  {invalidCount} errors
                </Badge>
              )}
            </div>

            <ScrollArea className="flex-1 border rounded-lg">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-10">Status</TableHead>
                    <TableHead>Date</TableHead>
                    <TableHead>Description</TableHead>
                    <TableHead>Category</TableHead>
                    <TableHead className="text-right">Amount</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {parsedRows.slice(0, 100).map((row, i) => (
                    <TableRow
                      key={i}
                      className={row.isValid ? "" : "bg-destructive/5"}
                    >
                      <TableCell>
                        {row.isValid ? (
                          <Check className="h-4 w-4 text-green-500" />
                        ) : (
                          <AlertCircle className="h-4 w-4 text-destructive" />
                        )}
                      </TableCell>
                      <TableCell className="text-sm">{row.date}</TableCell>
                      <TableCell className="text-sm max-w-[200px] truncate">
                        {row.description}
                      </TableCell>
                      <TableCell>
                        <Badge variant="secondary" className="text-xs">
                          {row.category}
                        </Badge>
                      </TableCell>
                      <TableCell
                        className={`text-right font-mono text-sm ${
                          row.amount < 0 ? "text-red-500" : "text-green-500"
                        }`}
                      >
                        {row.amount < 0 ? "-" : "+"}$
                        {Math.abs(row.amount).toFixed(2)}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
              {parsedRows.length > 100 && (
                <p className="text-center text-sm text-muted-foreground py-2">
                  Showing first 100 of {parsedRows.length} rows
                </p>
              )}
            </ScrollArea>

            <div className="flex justify-end gap-2 mt-4">
              <Button variant="outline" onClick={() => setStep("mapping")}>
                Back
              </Button>
              <Button
                onClick={() => importMutation.mutate()}
                disabled={validCount === 0 || importMutation.isPending}
                data-testid="button-import-transactions"
              >
                {importMutation.isPending ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    Importing...
                  </>
                ) : (
                  <>
                    Import {validCount} Transactions
                    <ArrowRight className="h-4 w-4 ml-2" />
                  </>
                )}
              </Button>
            </div>
          </div>
        )}

        {step === "complete" && (
          <div className="flex flex-col items-center justify-center py-12">
            <div className="flex h-16 w-16 items-center justify-center rounded-full bg-green-500/10 mb-4">
              <Check className="h-8 w-8 text-green-500" />
            </div>
            <h3 className="text-lg font-semibold mb-2">Import Complete!</h3>
            <p className="text-muted-foreground mb-6">
              Successfully imported {validCount} transactions
            </p>
            <Button onClick={() => onOpenChange(false)} data-testid="button-close-import">
              Close
            </Button>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
