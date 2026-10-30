// Compatibility entry point. Never execute the historical destructive SQL.
console.log('029 histórico -> actualización compatible 030; diagnóstico por defecto, --apply para aplicar.');
await import('./apply-communications-upgrade.mjs');
