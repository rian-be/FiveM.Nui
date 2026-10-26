import { mount } from 'svelte';
import './styles.css';
import App from './App.svelte';

const target = document.getElementById('app') ?? document.body;

const app = mount(App, { target });

export default app;
