// Client-side document generation.
//
// The server (/api/approve/prepare) tailors the resume + cover and returns
// print-ready HTML. The BROWSER renders that HTML to PDF here (html2pdf.js, no
// server/headless Chromium), then posts the PDFs to /api/approve/save which
// uploads them and marks the application approved.

export interface GeneratedDocs {
  resume_storage_url: string;
  cover_letter_storage_url: string;
}

// Render one full HTML document to a PDF Blob using an offscreen iframe so the
// document's own <style>/@page rules apply, then html2canvas+jsPDF via html2pdf.
async function htmlToPdfBlob(html: string): Promise<Blob> {
  const mod: any = await import('html2pdf.js');
  const html2pdf = (mod.default ?? mod) as any;

  const iframe = document.createElement('iframe');
  iframe.setAttribute('aria-hidden', 'true');
  // ~A4 width at 96dpi (210mm ≈ 794px); kept offscreen but rendered.
  iframe.style.cssText = 'position:fixed;left:-10000px;top:0;width:794px;height:1123px;border:0;';
  document.body.appendChild(iframe);

  try {
    const idoc = iframe.contentDocument!;
    idoc.open();
    idoc.write(html);
    idoc.close();

    // Let layout settle (and fonts resolve — the template uses system fonts).
    try {
      await (idoc as Document & { fonts?: { ready?: Promise<unknown> } }).fonts?.ready;
    } catch {
      /* fonts API not critical */
    }
    await new Promise(r => setTimeout(r, 200));

    const target = (idoc.querySelector('.page') as HTMLElement | null) ?? idoc.body;

    const blob: Blob = await html2pdf()
      .set({
        margin: 0,
        image: { type: 'jpeg', quality: 0.98 },
        html2canvas: { scale: 2, useCORS: true, backgroundColor: '#ffffff', windowWidth: 794 },
        jsPDF: { unit: 'mm', format: 'a4', orientation: 'portrait' },
        pagebreak: { mode: ['css', 'legacy'] },
      })
      .from(target)
      .outputPdf('blob');

    return blob;
  } finally {
    document.body.removeChild(iframe);
  }
}

export async function generateAndSaveDocs(applicationId: string): Promise<GeneratedDocs> {
  // 1) Server tailors and returns HTML.
  const prep = await fetch('/api/approve/prepare', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ id: applicationId }),
  });
  const prepData = await prep.json().catch(() => ({}));
  if (!prep.ok || !prepData.ok) {
    throw new Error(prepData?.error || 'Failed to prepare documents');
  }
  const { resumeHtml, coverHtml, prefix } = prepData as {
    resumeHtml: string;
    coverHtml: string;
    prefix: string;
  };

  // 2) Render both PDFs in the browser (sequentially — one render at a time).
  const resumePdf = await htmlToPdfBlob(resumeHtml);
  const coverPdf = await htmlToPdfBlob(coverHtml);

  // 3) Upload + mark approved on the server.
  const form = new FormData();
  form.append('id', applicationId);
  form.append('prefix', prefix);
  form.append('resume', resumePdf, `${prefix}-resume.pdf`);
  form.append('cover', coverPdf, `${prefix}-cover-letter.pdf`);

  const save = await fetch('/api/approve/save', { method: 'POST', body: form });
  const saveData = await save.json().catch(() => ({}));
  if (!save.ok || !saveData.ok) {
    throw new Error(saveData?.error || 'Failed to save documents');
  }

  return {
    resume_storage_url: saveData.resume_storage_url,
    cover_letter_storage_url: saveData.cover_letter_storage_url,
  };
}
