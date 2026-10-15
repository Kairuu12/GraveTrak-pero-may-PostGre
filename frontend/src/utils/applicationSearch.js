const normalize = value => String(value ?? '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().trim();

export function filterApplications(applications, query) {
  const terms = normalize(query).split(/\s+/).filter(Boolean);
  if (!terms.length) return applications;
  return applications.filter(app => {
    const text = [app.applicant_name, app.deceased_name, app.application_id,
      app.applicant_address, app.applicant_contact_email, app.applicant_email,
      app.user, app.appId, app.name, app.message].map(normalize).join(' ');
    return terms.every(term => text.includes(term));
  });
}
