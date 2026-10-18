import test from 'node:test';
import assert from 'node:assert/strict';
import {issueEntrance,validEntrance} from '../lib/access.ts';
process.env.ENTRY_PASSWORD='test-password';process.env.AUTH_SECRET='local-test-signing-key';
test('entrance rejects missing, forged and expired cookies',()=>{const time=Date.now(),token=issueEntrance(time);assert.equal(validEntrance(undefined,time),false);assert.equal(validEntrance(token,time),true);assert.equal(validEntrance(token+'x',time),false);assert.equal(validEntrance(token,time-1),false);assert.equal(validEntrance(token,time+8*86400000),false)});
test('changing entrance password revokes previous cookies',()=>{const token=issueEntrance();process.env.ENTRY_PASSWORD='rotated-password';assert.equal(validEntrance(token),false)});
