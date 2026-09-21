function roleFromReference(reference) {
  if (/(?:^|[_-])SI(?:[_.-]|$)/i.test(reference)) return 'SI';
  if (/(?:^|[_-])BL(?:[_.-]|$)/i.test(reference)) return 'BL';
  return 'UNKNOWN';
}

export function identifyDocumentRoles(attachments) {
  const identified = attachments.map((attachment) => ({
    ...attachment,
    documentType: roleFromReference(attachment.reference)
  }));
  const si = identified.filter((attachment) => attachment.documentType === 'SI');
  const bl = identified.filter((attachment) => attachment.documentType === 'BL');

  return {
    si: si.length === 1 ? si[0] : null,
    bl: bl.length === 1 ? bl[0] : null,
    valid: si.length === 1 && bl.length === 1
  };
}

