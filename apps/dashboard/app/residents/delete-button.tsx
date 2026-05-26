'use client';

import { deleteResidentAction } from '../actions/admin';

export function DeleteButton({ id }: { id: string }) {
  return (
    <form action={deleteResidentAction}>
      <input type="hidden" name="id" value={id} />
      <button
        type="submit"
        className="rounded border border-red-200 bg-red-50 px-2 py-1 text-xs text-red-600 hover:bg-red-100"
        onClick={(e) => {
          if (!confirm('Delete this resident and all their data?')) e.preventDefault();
        }}
      >
        Delete
      </button>
    </form>
  );
}
