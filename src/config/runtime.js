export function allowedOrigins() {
  return (process.env.CLIENT_ORIGIN || "").split(",").map((value) => value.trim()).filter(Boolean);
}

export function sessionSeconds() {
  const value = process.env.JWT_EXPIRES_IN || "2h";
  const match = /^(\d+)(s|m|h|d|w)?$/.exec(value);
  const seconds = match && Number(match[1]) * ({ s: 1, m: 60, h: 3600, d: 86400, w: 604800 }[match[2]] || 1);
  if (!Number.isSafeInteger(seconds) || seconds < 1 || seconds > 2147483) {
    throw new Error("JWT_EXPIRES_IN must be a positive integer in seconds or use s/m/h/d/w (maximum 24 days)");
  }
  return seconds;
}

export function cookieOptions() {
  return {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: process.env.COOKIE_SAME_SITE || "lax",
    path: "/",
  };
}

export function validateEnvironment() {
  for (const key of ["MONGODB_URI", "JWT_SECRET", "CLIENT_ORIGIN"]) {
    if (!process.env[key]?.trim()) throw new Error(`Missing env variable: ${key}`);
  }
  if (process.env.JWT_SECRET.length < 32) throw new Error("JWT_SECRET must contain at least 32 characters");
  if (!/^mongodb(\+srv)?:\/\//.test(process.env.MONGODB_URI)) throw new Error("MONGODB_URI must be a MongoDB connection URI");
  const origins = allowedOrigins();
  if (!origins.length || origins.some((origin) => {
    try {
      const url = new URL(origin);
      return !["http:", "https:"].includes(url.protocol) || url.origin !== origin ||
        (process.env.NODE_ENV === "production" && url.protocol !== "https:");
    } catch { return true; }
  })) throw new Error("CLIENT_ORIGIN must contain comma-separated exact HTTP(S) origins (HTTPS in production), without paths or trailing slashes");
  if (!["lax", "strict", "none"].includes(cookieOptions().sameSite)) throw new Error("COOKIE_SAME_SITE must be lax, strict or none");
  if (cookieOptions().sameSite === "none" && !cookieOptions().secure) throw new Error("SameSite=None requires production HTTPS Secure cookies");
  if (process.env.PORT && !/^[0-9]+$/.test(process.env.PORT)) throw new Error("PORT must be an integer");
  const port = Number(process.env.PORT || 5000);
  if (port < 1 || port > 65535) throw new Error("PORT must be between 1 and 65535");
  if (process.env.TRUST_PROXY && !/^[1-9]\d?$/.test(process.env.TRUST_PROXY)) throw new Error("TRUST_PROXY must be an explicit positive proxy hop count");
  sessionSeconds();
}
