import { UploadReportStatus } from "./UploadReportStatus";

export type UploadReport = {
  name: string;
  date: string;
  status: UploadReportStatus;
  statusUrl: string;
  response?: Record<string, any>;
  stderr?: string;

  // Report ID is the ID of the report, as received from the server.
  // This is used to identify the report in the server.
  reportId: string;

  // Reference ID is the local ID of the report.
  // It is generated using a slug of the report name and a incrementing number.
  // This is used to identify the report in the local storage.
  referenceId: string;

  // Is a report generated by the user.
  // Or is it an opened shared report.
  isFromSharing: boolean;
};

export class Report {
  readonly fromSharing: boolean;

  private constructor(
    public readonly id: string,
    public readonly name: string,
    public readonly date: string,
    public status: UploadReportStatus,
    public readonly url: string,
    public readonly datasetURL?: string,
    public readonly stderr?: string,
    public error?: string,
    public slug?: string,
    fromSharing?: boolean,
  ) {
    this.fromSharing = fromSharing || false;
  }

  public hasFinalStatus() {
    return this.status === "finished" || this.status === "error" || this.status === "failed";
  }

  static fromResponse(response: Record<string, any>, slug?: string, fromSharing?: boolean): Report {
    return new Report(
      response.id,
      response.name,
      response.created_at,
      response.status,
      response.url,
      response.dataset?.zipfile,
      response.stderr?.replace(/\s*.\[\d+m\[error\].\[\d+m\s*/g, ""),
      response.error,
      slug,
      fromSharing
    );
  }

  static fromUploadReport(report: UploadReport): Report {
    return new Report(
      report.reportId,
      report.name,
      report.date,
      report.status,
      `${import.meta.env.VITE_API_URL}/reports/${report.reportId}`,
      report.response?.dataset?.zipfile,
      report.stderr,
      undefined,
      report.referenceId,
      report.isFromSharing
    );
  }

  static arrayFromSerialized(serialized: string): Report[] {
    return (JSON.parse(serialized) as Record<string, any>[])
      .map(object =>
        new Report(
          object.id,
          object.name,
          object.date,
          object.status,
          object.url,
          object.datasetURL,
          object.stderr,
          object.error,
          object.slug,
          object.isFromSharing
        )
      );
  }
}
