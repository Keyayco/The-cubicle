import './styles.css';
import { bootstrapApplication } from './core';
import { demoPlugin } from './plugins/demo-plugin';

await bootstrapApplication({
  plugins: [demoPlugin],
});
