import puppeteer, { Page } from "puppeteer";
import axios from "axios";
import * as path from "node:path";
import * as fs from "node:fs";
import { fileURLToPath } from "node:url";
import { createClient } from "webdav";

const LOGIN_URL = "https://monpromologis.fr/site/connexionextranet/accueil";
const QUITTANCES_URL = "https://monpromologis.fr/site/extranetlocatairepromologis/quittances";

type QuittanceInput = {
  monthsBack?: number;
  email?: string;
  password?: string;
  webdavUrl?: string;
  webdavUsername?: string;
  webdavPassword?: string;
  webdavRemoteDir?: string;
  debug?: boolean;
};

type WebdavConfig = {
  url: string;
  username: string;
  password: string;
  remoteDir: string;
};

const logger = buildRuntimeLogger("quittance");

function buildRuntimeLogger(taskPrefix?: string) {
  const write = (level: string, message: string, metadata?: Record<string, unknown>) => {
    const payload = {
      timestamp: Date.now(),
      level,
      message: taskPrefix ? `${taskPrefix} ${message}` : message,
      ...(metadata ? { metadata } : {}),
    }
    process.stderr.write(`${JSON.stringify(payload)}\n`)
  }

  return {
    info: (message: string, ...args: any[]) => write('INFO', format(message, args)),
    warn: (message: string, ...args: any[]) => write('WARN', format(message, args)),
    error: (message: string, ...args: any[]) => write('ERROR', format(message, args)),
    debug: (message: string, ...args: any[]) => write('DEBUG', format(message, args)),
  }
}

function format(message: string, args: any[]): string {
  if (!args?.length) return message
  try {
    return `${message} ${args.map(a => (typeof a === 'string' ? a : JSON.stringify(a))).join(' ')}`
  } catch {
    return message
  }
}

function resolveRequiredCredential(inputValue: unknown, envName: string): string {
  const fromInput = typeof inputValue === 'string' ? inputValue.trim() : '';
  if (fromInput.length > 0) return fromInput;

  const fromEnv = (process.env[envName] || '').trim();
  if (fromEnv.length > 0) return fromEnv;

  throw new Error(`Missing required credential '${envName}'`);
}

function redactInput(input: QuittanceInput): Record<string, unknown> {
  return {
    monthsBack: input.monthsBack,
    email: input.email ? '***MASKED***' : undefined,
    password: input.password ? '***MASKED***' : undefined,
    webdavUrl: input.webdavUrl,
    webdavUsername: input.webdavUsername ? '***MASKED***' : undefined,
    webdavPassword: input.webdavPassword ? '***MASKED***' : undefined,
    webdavRemoteDir: input.webdavRemoteDir,
    debug: input.debug,
  };
}

async function dumpPageDebugArtifacts(page: Page, downloadPath: string, label: string): Promise<void> {
  const safeLabel = label.replace(/[^a-zA-Z0-9-_]/g, '_');
  const screenshotPath = path.join(downloadPath, `debug-${safeLabel}.png`);
  const htmlPath = path.join(downloadPath, `debug-${safeLabel}.html`);

  try {
    await page.screenshot({ path: screenshotPath, fullPage: true });
    logger.info(`🧪 Screenshot debug: ${screenshotPath}`);
  } catch (error) {
    logger.warn(`Failed to capture screenshot: ${error instanceof Error ? error.message : String(error)}`);
  }

  try {
    const html = await page.content();
    fs.writeFileSync(htmlPath, html, 'utf8');
    logger.info(`🧪 HTML debug: ${htmlPath}`);
  } catch (error) {
    logger.warn(`Failed to dump HTML: ${error instanceof Error ? error.message : String(error)}`);
  }
}

async function collectLoginContext(page: Page): Promise<{ url: string; loginVisible: boolean; hint?: string }> {
  const url = page.url();
  const loginVisible = (await page.$('#login')) !== null;

  const hint = await page.evaluate(() => {
    const selectors = [
      '.alert',
      '.alert-danger',
      '.error',
      '.message-erreur',
      '.invalid-feedback',
      '.notification',
    ];
    for (const selector of selectors) {
      const element = document.querySelector(selector);
      if (element && element.textContent) {
        const text = element.textContent.trim();
        if (text.length > 0) return text.slice(0, 400);
      }
    }
    return undefined;
  });

  return { url, loginVisible, hint };
}

function resolveOptionalConfig(inputValue: unknown, envName: string, defaultValue?: string): string {
  const fromInput = typeof inputValue === 'string' ? inputValue.trim() : '';
  if (fromInput.length > 0) return fromInput;

  const fromEnv = (process.env[envName] || '').trim();
  if (fromEnv.length > 0) return fromEnv;

  if (defaultValue !== undefined) return defaultValue;
  throw new Error(`Missing required configuration '${envName}'`);
}

function resolveWebdavConfig(input: QuittanceInput): WebdavConfig {
  return {
    url: resolveOptionalConfig(input.webdavUrl, 'WEBDAV_URL'),
    username: resolveOptionalConfig(input.webdavUsername, 'WEBDAV_USER'),
    password: resolveOptionalConfig(input.webdavPassword, 'WEBDAV_PASSWORD'),
    remoteDir: resolveOptionalConfig(input.webdavRemoteDir, 'WEBDAV_REMOTE_DIR', '/quittances'),
  };
}

function getTargetMonth(offset: number) {
  const date = new Date();
  date.setMonth(date.getMonth() - offset);
  return {
    monthLabel: date.toLocaleString("fr-FR", { month: "long" }),
    year: date.getFullYear(),
  };
}

async function closeModal(selector: string, page: Page, timeout = 3000) {
  try {
    await page.waitForSelector(selector, { visible: true, timeout });
    await page.click(selector);
    await new Promise((r) => setTimeout(r, 500));
    logger.info(`Modal ${selector} fermée`);
  } catch {
    // Modal non présente, on continue
  }
}

async function uploadToWebdav(localFilePath: string, remoteFilename: string, webdav: WebdavConfig): Promise<void> {
  const client = createClient(webdav.url, {
    username: webdav.username,
    password: webdav.password,
  });

  const remotePath = `${webdav.remoteDir}/${remoteFilename}`;

  // Créer le répertoire distant si nécessaire
  const dirExists = await client.exists(webdav.remoteDir);
  if (!dirExists) {
    await client.createDirectory(webdav.remoteDir, { recursive: true });
    logger.info(`📁 Répertoire créé: ${webdav.remoteDir}`);
  }

  // Upload du fichier
  const fileContent = fs.readFileSync(localFilePath);
  await client.putFileContents(remotePath, fileContent, { overwrite: true });

  logger.info(`✅ Fichier uploadé via WebDAV: ${remotePath}`);
}

async function downloadPdfWithHttp(
  url: string,
  cookieString: string,
  downloadPath: string,
  filename: string
): Promise<string> {
  const filepath = path.join(downloadPath, filename);

  const response = await axios({
    method: "GET",
    url,
    responseType: "stream",
    headers: {
      Cookie: cookieString,
      "User-Agent": "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
      Accept: "application/pdf,*/*",
      Referer: QUITTANCES_URL,
    },
    maxRedirects: 5,
  });

  const writer = fs.createWriteStream(filepath);
  response.data.pipe(writer);

  return new Promise((resolve, reject) => {
    writer.on("finish", () => resolve(filepath));
    writer.on("error", reject);
  });
}

async function main() {
  logger.info("🚀 Démarrage du plugin quittance...");

  const raw = await Bun.stdin.text()
  const req = JSON.parse(raw)

  if (!req || typeof req !== 'object') {
    throw new Error('Invalid input: expected JSON object')
  }

  const { action, input } = req as { action?: string; input?: unknown }
  if (action !== 'get') {
    throw new Error(`Unsupported action: ${String(action)}`)
  }

  const inputObj = (input && typeof input === 'object') ? (input as QuittanceInput) : {};
  const email = resolveRequiredCredential(inputObj.email, 'PROMOLOGIS_EMAIL');
  const password = resolveRequiredCredential(inputObj.password, 'PROMOLOGIS_PASSWORD');
  const webdav = resolveWebdavConfig(inputObj);
  const debug = Boolean(inputObj.debug);

  logger.info("🚀 Exécution de l'action 'get' avec input:", redactInput(inputObj));

  const __filename = fileURLToPath(import.meta.url);
  const __dirname = path.dirname(__filename);
  const downloadPath = path.resolve(__dirname, "../downloads");

  logger.info(`📂 Chemin de téléchargement: ${downloadPath}`);

  fs.mkdirSync(downloadPath, { recursive: true });

  const browser = await puppeteer.launch({
    headless: true,
    args: ["--no-sandbox", "--disable-setuid-sandbox"],
  });

  const page = await browser.newPage();
  await page.setUserAgent({
    userAgent: "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"
  });
  await page.setViewport({ width: 1920, height: 1080 });

  page.on('requestfailed', (request) => {
    logger.warn(`Request failed: ${request.method()} ${request.url()} -> ${request.failure()?.errorText || 'unknown'}`);
  });

  page.on('pageerror', (error) => {
    const message = error instanceof Error ? error.message : String(error);
    if (message.includes('accesskey is not defined')) {
      logger.info('Site JS warning ignored: accesskey is not defined');
      return;
    }
    logger.warn(`Page error: ${message}`);
  });

  // 1) Login
  await page.goto(LOGIN_URL, { waitUntil: "networkidle2" });

  await closeModal("#sylogis_widget_ModalButton_0", page); // Popup app
  await closeModal("#bcb-buttonAgreeAll", page);      // Cookies
  await await new Promise((r) => setTimeout(r, 1000));
  await closeModal("#sylogis_widget_ModalButton_0", page); // Popup app

  await page.waitForSelector("#login", { visible: true });
  await page.type("#login", email, { delay: 20 });
  await page.type("#password", password, { delay: 20 });
  await page.click("#validate");

  logger.info("🔐 Login soumis...");

  try {
    await page.waitForFunction(
      () => window.location.pathname.includes("extranetlocatairepromologis"),
      { timeout: 5000 }
    );
  } catch (error) {
    const loginContext = await collectLoginContext(page);
    logger.error(
      `⛔ Login validation timeout after submit. ` +
      `Current URL: ${loginContext.url}. ` +
      `Login field visible: ${loginContext.loginVisible ? 'yes' : 'no'}.` +
      `${loginContext.hint ? ` Hint: ${loginContext.hint}` : ''}`
    );

    if (debug) {
      await dumpPageDebugArtifacts(page, downloadPath, 'login-timeout');
    }

    throw new Error(
      `Login did not reach expected page within timeout (current URL: ${loginContext.url}). ` +
      `Enable input.debug=true to collect screenshot/html artifacts.`
    );
  }

  logger.info("✅ Connecté");

  // 2) Page quittances
  await page.goto(QUITTANCES_URL, { waitUntil: "networkidle2" });
  await closeModal("#lisio-popup-info-close", page);
  await dumpPageDebugArtifacts(page, downloadPath, 'quittances-page');

  const monthsBackRaw = inputObj.monthsBack;
  const monthsBack = Number.isFinite(Number(monthsBackRaw)) ? Math.max(0, Math.trunc(Number(monthsBackRaw))) : 2;

  const { monthLabel, year } = getTargetMonth(monthsBack);
  logger.info(`📅 Recherche quittance: ${monthLabel} ${year}`);

  await page.waitForSelector("tbody tr", { timeout: 15000 });

  // 3) Trouver l'URL du PDF
  const downloadUrl = await page.evaluate((mois: string, annee: number) => {
    const rows = Array.from(document.querySelectorAll("tbody tr"));
    for (const row of rows) {
      const cells = row.querySelectorAll("td");
      if (cells.length < 3) continue;
      const rowMonth = cells[0].textContent?.trim().toLowerCase();
      const rowYear = cells[1].textContent?.trim();
      if (rowMonth === mois.toLowerCase() && rowYear === String(annee)) {
        const link = cells[2].querySelector("a");
        return link instanceof HTMLAnchorElement ? link.href : null;
      }
    }
    return null;
  }, monthLabel, year);

  if (!downloadUrl) {
    logger.error("⚠️ Quittance introuvable");
    await browser.close();

    process.stdout.write(JSON.stringify({
      message: "Quittance introuvable",
    }))
    return;
  }

  logger.info("🔗 URL trouvée:", downloadUrl);

  // 4) Récupérer les cookies pour le téléchargement HTTP
  const cookies = await page.cookies();
  const cookieString = cookies.map((c: { name: string; value: string }) => `${c.name}=${c.value}`).join("; ");

  await browser.close();

  // 5) Télécharger via HTTP
  const filename = `quittance_${year}_${monthLabel}.pdf`;
  const filepath = await downloadPdfWithHttp(downloadUrl, cookieString, downloadPath, filename);

  // Vérifier que c'est un vrai PDF
  const header = fs.readFileSync(filepath).slice(0, 5).toString();
  if (!header.startsWith("%PDF")) {
    fs.unlinkSync(filepath);
    throw new Error("Le fichier téléchargé n'est pas un PDF valide");
  }

  logger.info(`✅ Quittance téléchargée: ${filename}`);

  // 6) Upload vers WebDAV
  await uploadToWebdav(filepath, filename, webdav);

  process.stdout.write(JSON.stringify({
    message: "ok",
  }))
}

main().catch((err) => {
  // process.stderr.write(`🚨 Erreur: ${err.message}\n`);
  const message = err instanceof Error ? err.message : String(err);
  logger.error(`Erreur: ${message}`);
  process.stderr.write(JSON.stringify({
    message: `Erreur: ${message}`,
  }))
  process.exit(1)
});


