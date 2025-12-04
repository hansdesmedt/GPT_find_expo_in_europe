import { indexAllSources } from './src/services/indexer.js';
import pool from './src/database/db.js';

async function main() {
  try {
    console.log('Starting indexing with image extraction...\n');
    const results = await indexAllSources();

    console.log('\n📊 Final Summary:');
    console.log('================');

    const successful = results.filter(r => r.status === 'success');
    const failed = results.filter(r => r.status === 'failed');

    console.log(`✅ Successful: ${successful.length}`);
    console.log(`❌ Failed: ${failed.length}`);
    console.log(`📝 Total exhibitions found: ${successful.reduce((sum, r) => sum + r.exhibitions_found, 0)}`);

    if (failed.length > 0) {
      console.log('\nFailed venues:');
      failed.forEach(f => console.log(`  - ${f.venue}: ${f.error}`));
    }

  } catch (error) {
    console.error('Fatal error:', error);
  } finally {
    await pool.end();
    process.exit(0);
  }
}

main();
