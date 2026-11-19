import React, { useMemo } from 'react';
import { Download, FileSpreadsheet } from 'lucide-react';
import type { InstallmentApplication, SaleSubmissionList } from '../types/khallegacy';
import {
  formatDateShort,
  formatRM,
  resolveActualCashPayment,
} from '../utils/businessRules';
import { Modal } from './Modal';

interface SubmissionListDetailModalProps {
  submission: SaleSubmissionList | null;
  applications: InstallmentApplication[];
  onClose: () => void;
  onExportCsv: (filename: string, rows: string[][]) => void;
  onDownloadPdf: (submission: SaleSubmissionList) => void;
  onViewDetails: (appId: string) => void;
}

export const SubmissionListDetailModal: React.FC<SubmissionListDetailModalProps> = ({
  submission,
  applications,
  onClose,
  onExportCsv,
  onDownloadPdf,
  onViewDetails,
}) => {
  const viewingApps = useMemo(() => {
    if (!submission) return [];
    const appMap = new Map(applications.map((a) => [a.id, a]));
    return submission.agreementIds
      .map((id) => appMap.get(id))
      .filter((a): a is InstallmentApplication => Boolean(a));
  }, [submission, applications]);

  const handleExportCsv = (sub: SaleSubmissionList) => {
    const appById = new Map(applications.map((a) => [a.id, a]));
    const rows: string[][] = [
      ['Submission List ID', sub.submissionListId],
      ['Submission Date', sub.submissionDate],
      ['Created By', sub.createdBy],
      ['Total Agreements', String(sub.agreementCount)],
      ['Total Actual Cash Payment (RM)', sub.totalActualCashPayment.toFixed(2)],
      [],
      [
        'No',
        'IC Number',
        'Customer Name',
        'Product',
        'Finance Amount (RM)',
        'Deposit (RM)',
        'Stamp Duty Fee (RM)',
        'Processing Fee (RM)',
        'Actual Cash Payment (RM)',
      ],
      ...sub.agreementIds.map((id, idx) => {
        const app = appById.get(id);
        if (!app) {
          return [String(idx + 1), '—', '—', '—', '0.00', '0.00', '0.00', '0.00', '0.00'];
        }
        const productTitle = app.products
          .map((p) => `${p.productName}${p.model ? ` (${p.model})` : ''}`)
          .join(', ');
        return [
          String(idx + 1),
          app.icNumber,
          app.customerName,
          productTitle,
          app.financing.financingAmount.toFixed(2),
          app.financing.deposit.toFixed(2),
          app.financing.stampDutyFee.toFixed(2),
          app.financing.processingFee.toFixed(2),
          resolveActualCashPayment(app.financing).toFixed(2),
        ];
      }),
    ];
    onExportCsv(`${sub.submissionListId}.csv`, rows);
  };

  return (
    <Modal
      open={Boolean(submission)}
      onClose={onClose}
      title={
        submission
          ? `Submission List — ${submission.submissionListId}`
          : 'Submission List Details'
      }
      subtitle={
        submission
          ? `Created ${formatDateShort(submission.submissionDate)} · By ${submission.createdBy}`
          : undefined
      }
      maxWidthClass="max-w-6xl"
      footer={
        submission && (
          <div className="w-full flex items-center justify-between gap-2">
            <div className="flex flex-wrap items-center gap-2">
              <button
                type="button"
                onClick={() => handleExportCsv(submission)}
                className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-medium text-blue-700 bg-blue-50 border border-blue-200 hover:bg-blue-100 rounded-lg transition-colors"
              >
                <FileSpreadsheet className="w-3.5 h-3.5" />
                Export CSV
              </button>
              <button
                type="button"
                onClick={() => onDownloadPdf(submission)}
                className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-semibold text-white bg-blue-600 hover:bg-blue-700 rounded-lg transition-colors"
              >
                <Download className="w-3.5 h-3.5" />
                Download
              </button>
            </div>
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-xs font-medium text-slate-700 bg-white border border-slate-200 hover:bg-slate-50 rounded-lg transition-colors"
            >
              Close
            </button>
          </div>
        )
      }
    >
      {submission && (
        <div className="space-y-4 text-xs">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div className="p-3 bg-slate-50 border border-slate-200 rounded-lg">
              <p className="text-[11px] text-slate-500">Agreements Selected</p>
              <p className="text-base font-semibold text-slate-900 tabular-nums mt-0.5">
                {submission.agreementCount}
              </p>
            </div>
            <div className="p-3 bg-slate-50 border border-slate-200 rounded-lg">
              <p className="text-[11px] text-slate-500">Total Product Amount</p>
              <p className="text-base font-semibold text-slate-900 font-mono-tabular mt-0.5">
                {formatRM(submission.totalProductAmount)}
              </p>
            </div>
            <div className="p-3 bg-emerald-50/60 border border-emerald-200 rounded-lg">
              <p className="text-[11px] text-emerald-700">Total Actual Cash Payment</p>
              <p className="text-base font-semibold text-emerald-700 font-mono-tabular mt-0.5">
                {formatRM(submission.totalActualCashPayment)}
              </p>
            </div>
          </div>

          {submission.remarks && (
            <div className="p-3 bg-slate-50 border border-slate-200 rounded-lg text-slate-700">
              <span className="font-semibold text-slate-900">Remarks:</span>{' '}
              {submission.remarks}
            </div>
          )}

          <div className="border border-slate-200 rounded-lg overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="bg-slate-50 border-b border-slate-200 text-[10px] font-semibold text-slate-500 uppercase tracking-wider">
                    <th className="py-2.5 pl-3 pr-1.5 whitespace-nowrap">No</th>
                    <th className="py-2.5 px-1.5 whitespace-nowrap">IC Number</th>
                    <th className="py-2.5 px-1.5 whitespace-nowrap">Customer Name</th>
                    <th className="py-2.5 px-1.5 whitespace-nowrap">Product</th>
                    <th className="py-2.5 px-1.5 text-right whitespace-nowrap">Finance Amount</th>
                    <th className="py-2.5 px-1.5 text-right whitespace-nowrap">Deposit</th>
                    <th className="py-2.5 px-1.5 text-right whitespace-nowrap">Stamp Duty Fee</th>
                    <th className="py-2.5 px-1.5 text-right whitespace-nowrap">Processing Fee</th>
                    <th className="py-2.5 pl-1.5 pr-3 text-right whitespace-nowrap">
                      Actual Cash Payment
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 text-[11px]">
                  {viewingApps.map((app, idx) => {
                    const primaryProduct = app.products[0]?.productName ?? '—';
                    const extraCount = Math.max(0, app.products.length - 1);
                    const productTooltip = app.products
                      .map((p) => `${p.productName}${p.model ? ` (${p.model})` : ''}`)
                      .join(', ');
                    return (
                      <tr key={app.id} className="hover:bg-slate-50">
                        <td className="py-2.5 pl-3 pr-1.5 whitespace-nowrap tabular-nums text-slate-500">
                          {idx + 1}
                        </td>
                        <td
                          className="py-2.5 px-1.5 whitespace-nowrap font-mono-tabular text-slate-700"
                          title={app.caseId}
                        >
                          {app.icNumber}
                        </td>
                        <td className="py-2.5 px-1.5 whitespace-nowrap font-medium text-blue-600 max-w-[170px] truncate">
                          <button
                            type="button"
                            onClick={() => {
                              onClose();
                              onViewDetails(app.id);
                            }}
                            className="hover:underline text-left truncate max-w-full"
                            title={`View ${app.caseId} (${app.customerName})`}
                          >
                            {app.customerName}
                          </button>
                        </td>
                        <td
                          className="py-2.5 px-1.5 whitespace-nowrap text-slate-700 max-w-[170px] truncate"
                          title={productTooltip}
                        >
                          {extraCount > 0 ? `${primaryProduct} (+${extraCount})` : primaryProduct}
                        </td>
                        <td className="py-2.5 px-1.5 whitespace-nowrap text-right font-mono-tabular text-slate-700">
                          {formatRM(app.financing.financingAmount)}
                        </td>
                        <td className="py-2.5 px-1.5 whitespace-nowrap text-right font-mono-tabular text-slate-700">
                          {formatRM(app.financing.deposit)}
                        </td>
                        <td className="py-2.5 px-1.5 whitespace-nowrap text-right font-mono-tabular text-slate-700">
                          {formatRM(app.financing.stampDutyFee)}
                        </td>
                        <td className="py-2.5 px-1.5 whitespace-nowrap text-right font-mono-tabular text-slate-700">
                          {formatRM(app.financing.processingFee)}
                        </td>
                        <td className="py-2.5 pl-1.5 pr-3 whitespace-nowrap text-right font-mono-tabular font-semibold text-slate-900">
                          {formatRM(resolveActualCashPayment(app.financing))}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}
    </Modal>
  );
};
