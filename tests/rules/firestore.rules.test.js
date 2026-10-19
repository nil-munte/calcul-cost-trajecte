import { readFileSync } from 'node:fs';
import { after, before, beforeEach, describe, it } from 'node:test';
import { assertFails, assertSucceeds, initializeTestEnvironment } from '@firebase/rules-unit-testing';
import { deleteDoc, doc, getDoc, setDoc } from 'firebase/firestore';

let env;

before(async () => {
  env = await initializeTestEnvironment({
    projectId: 'demo-cost-trajecte',
    firestore: { rules: readFileSync('firestore.rules', 'utf8') }
  });
});
after(() => env.cleanup());
beforeEach(() => env.clearFirestore());

const trip = { date: '2026-10-19', km: 420, total: 18.56 };

describe('users/{uid}', () => {
  it("permet a l'usuari llegir i escriure els seus viatges", async () => {
    const db = env.authenticatedContext('alice').firestore();
    await assertSucceeds(setDoc(doc(db, 'users/alice/trips/t1'), trip));
    await assertSucceeds(getDoc(doc(db, 'users/alice/trips/t1')));
    await assertSucceeds(deleteDoc(doc(db, 'users/alice/trips/t1')));
  });

  it('permet les subcol·leccions (imatges i preferències)', async () => {
    const db = env.authenticatedContext('alice').firestore();
    await assertSucceeds(setDoc(doc(db, 'users/alice/trips/t1/images/i1'), { data: 'x' }));
    await assertSucceeds(setDoc(doc(db, 'users/alice/prefs/main'), { home: '0,14' }));
  });

  it("impedeix llegir o escriure dades d'un altre usuari", async () => {
    await env.withSecurityRulesDisabled((ctx) => setDoc(doc(ctx.firestore(), 'users/alice/trips/t1'), trip));
    const db = env.authenticatedContext('bob').firestore();
    await assertFails(getDoc(doc(db, 'users/alice/trips/t1')));
    await assertFails(setDoc(doc(db, 'users/alice/trips/t2'), trip));
  });

  it('impedeix qualsevol accés sense sessió', async () => {
    const db = env.unauthenticatedContext().firestore();
    await assertFails(getDoc(doc(db, 'users/alice/trips/t1')));
    await assertFails(setDoc(doc(db, 'users/alice/trips/t1'), trip));
  });

  it('impedeix escriure fora de users/', async () => {
    const db = env.authenticatedContext('alice').firestore();
    await assertFails(setDoc(doc(db, 'public/x'), { a: 1 }));
  });
});
