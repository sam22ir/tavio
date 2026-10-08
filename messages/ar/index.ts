import core from './core.json';
import auth from './auth.json';
import shell from './shell.json';
import views from './views.json';
import settings from './settings.json';
import contacts from './contacts.json';
import products from './products.json';
import l10n from './l10n.json';
import chatter from './chatter.json';
import credit from './credit.json';
import crm from './crm.json';

// Each namespace file is owned by one module or feature. Add keys there, never here.
const messages = { core, auth, shell, views, settings, contacts, products, l10n, chatter, credit, crm };
export default messages;
