const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function bootstrapAdminCredentials(env = process.env) {
  const email = env.BOOTSTRAP_ADMIN_EMAIL?.trim().toLowerCase();
  const password = env.BOOTSTRAP_ADMIN_PASSWORD;

  if (!email || !password) {
    throw new Error("BOOTSTRAP_ADMIN_EMAIL and BOOTSTRAP_ADMIN_PASSWORD are required for admin bootstrap");
  }
  if (!EMAIL_PATTERN.test(email)) throw new Error("BOOTSTRAP_ADMIN_EMAIL must be a valid email address");
  if (password.length < 16) throw new Error("BOOTSTRAP_ADMIN_PASSWORD must be at least 16 characters");

  return { email, password };
}
