/** The name customers see on tracking pages. Set COMPANY_NAME in .env.local or Vercel to change it. */
export function companyName(): string {
  return process.env.COMPANY_NAME?.trim() || "Werner Enterprises";
}
