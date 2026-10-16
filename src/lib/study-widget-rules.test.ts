import { test } from 'node:test';
import assert from 'node:assert/strict';
import { shouldInviteWidget, widgetTasks } from './study-widget-rules';
test('new user invited immediately after daily goal, never via to-dos', () => {
  assert.equal(shouldInviteWidget(true, false, true, 'daily-goal'), true);
  assert.equal(shouldInviteWidget(true, false, true, 'todos'), false);
});
test('existing user invited via to-dos, never repeats daily goal', () => {
  assert.equal(shouldInviteWidget(true, false, false, 'todos'), true);
  assert.equal(shouldInviteWidget(true, false, false, 'daily-goal'), false);
});
test('invitation is once-only and native-only', () => {
  assert.equal(shouldInviteWidget(true, true, false, 'todos'), false);
  assert.equal(shouldInviteWidget(false, false, false, 'todos'), false);
});
test('widget displays no more than three tasks and counts remaining tasks', () => {
  assert.deepEqual(widgetTasks([1,2,3,4,5]), { visible: [1,2,3], more: 2 });
});
