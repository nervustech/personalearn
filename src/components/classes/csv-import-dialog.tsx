"use client";

import { useState } from "react";
import Papa from "papaparse";
import { Upload } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog } from "@/components/ui/dialog";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { studentSchema, type StudentFormValues } from "@/lib/validations/class";
import { useCreateStudentsBulk } from "@/lib/hooks/use-classes";

const TEMPLATE_CSV = "full_name,admission_number,gender\nJane Doe,ADM001,Female\nJohn Kamau,ADM002,Male";

type CsvImportDialogProps = {
  classId: string;
};

export function CsvImportDialog({ classId }: CsvImportDialogProps) {
  const [open, setOpen] = useState(false);
  const [preview, setPreview] = useState<StudentFormValues[]>([]);
  const [parseError, setParseError] = useState<string | null>(null);
  const bulkCreate = useCreateStudentsBulk(classId);

  function downloadTemplate() {
    const blob = new Blob([TEMPLATE_CSV], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "student-roster-template.csv";
    a.click();
    URL.revokeObjectURL(url);
  }

  function handleFileChange(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file) return;
    setParseError(null);

    Papa.parse<Record<string, string>>(file, {
      header: true,
      skipEmptyLines: true,
      complete: (results) => {
        const parsed: StudentFormValues[] = [];
        const errors: string[] = [];

        results.data.forEach((row, index) => {
          const candidate = {
            full_name: row.full_name?.trim() ?? "",
            admission_number: row.admission_number?.trim() || undefined,
            gender:
              row.gender?.trim() === "Male" || row.gender?.trim() === "Female"
                ? (row.gender.trim() as "Male" | "Female")
                : undefined,
          };
          const result = studentSchema.safeParse(candidate);
          if (result.success) {
            parsed.push(result.data);
          } else {
            errors.push(`Row ${index + 2}: ${result.error.errors[0]?.message}`);
          }
        });

        if (errors.length) {
          setParseError(errors.slice(0, 3).join("; "));
          setPreview([]);
        } else {
          setPreview(parsed);
        }
      },
      error: (error) => setParseError(error.message),
    });

    event.target.value = "";
  }

  async function handleImport() {
    if (!preview.length) return;
    await bulkCreate.mutateAsync(preview);
    setPreview([]);
    setOpen(false);
  }

  return (
    <>
      <Button type="button" variant="secondary" size="sm" onClick={() => setOpen(true)}>
        <Upload className="mr-2 h-4 w-4" />
        Import CSV
      </Button>

      <Dialog
        open={open}
        onOpenChange={setOpen}
        title="Import students from CSV"
        description="Upload a CSV with columns: full_name, admission_number, gender"
      >
        <div className="space-y-4">
          <Button type="button" variant="secondary" size="sm" onClick={downloadTemplate}>
            Download template
          </Button>

          <div>
            <input
              type="file"
              accept=".csv,text/csv"
              onChange={handleFileChange}
              className="text-sm"
            />
          </div>

          {parseError ? <p className="text-sm text-destructive">{parseError}</p> : null}

          {preview.length > 0 ? (
            <>
              <p className="text-sm text-muted-foreground">
                {preview.length} student{preview.length === 1 ? "" : "s"} ready to import
              </p>
              <div className="max-h-48 overflow-auto rounded-xl border border-border">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Name</TableHead>
                      <TableHead>Admission</TableHead>
                      <TableHead>Gender</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {preview.slice(0, 10).map((row, i) => (
                      <TableRow key={i}>
                        <TableCell>{row.full_name}</TableCell>
                        <TableCell>{row.admission_number ?? "—"}</TableCell>
                        <TableCell>{row.gender ?? "—"}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
              {preview.length > 10 ? (
                <p className="text-xs text-muted-foreground">
                  Showing first 10 of {preview.length} rows
                </p>
              ) : null}
            </>
          ) : null}

          {bulkCreate.error ? (
            <p className="text-sm text-destructive">{bulkCreate.error.message}</p>
          ) : null}

          <div className="flex justify-end gap-2">
            <Button type="button" variant="secondary" onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <Button
              type="button"
              disabled={!preview.length || bulkCreate.isPending}
              onClick={handleImport}
            >
              {bulkCreate.isPending ? "Importing…" : "Confirm import"}
            </Button>
          </div>
        </div>
      </Dialog>
    </>
  );
}
