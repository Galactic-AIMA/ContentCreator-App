import fs from 'fs';
import path from 'path';

const OUTPUT_DIR = path.join(__dirname, '../../../output');
const MAX_AGE_MS = 24 * 60 * 60 * 1000; // 24 hours

export function startCleanupService() {
  console.log('✅ Cleanup service started. Will clean old files every 6 hours.');
  
  // Run immediately on startup
  cleanupOldFiles();

  // Run every 6 hours
  setInterval(cleanupOldFiles, 6 * 60 * 60 * 1000);
}

function cleanupOldFiles() {
  if (!fs.existsSync(OUTPUT_DIR)) return;

  const now = Date.now();
  let deletedCount = 0;

  try {
    const files = fs.readdirSync(OUTPUT_DIR);

    for (const file of files) {
      if (!file.endsWith('.mp4')) continue;

      const filePath = path.join(OUTPUT_DIR, file);
      const stats = fs.statSync(filePath);

      if (now - stats.mtimeMs > MAX_AGE_MS) {
        fs.unlinkSync(filePath);
        deletedCount++;
      }
    }

    if (deletedCount > 0) {
      console.log(`🧹 Cleanup Service: Deleted ${deletedCount} old video files.`);
    }
  } catch (error: any) {
    console.error('❌ Cleanup Service Error:', error.message);
  }
}
