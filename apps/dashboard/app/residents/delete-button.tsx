'use client';

import { deleteResidentAction } from '../actions/admin';

import { SubmitButton } from '../components/submit-button';

export function DeleteButton({ id }: { id: string }) {
  return (
    <form action={deleteResidentAction}>
      <input type="hidden" name="id" value={id} />
      <SubmitButton
        className="border-red-200 bg-red-50 !px-2 !py-1 !text-xs text-red-600 hover:bg-red-100 border"
      >
        <span onClick={(e) => {
          if (!confirm('Delete this resident and all their data?')) {
            e.preventDefault();
            e.stopPropagation();
          }
        }}>Delete</span>
      </SubmitButton>
    </form>
  );
}
