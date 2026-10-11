import { CategoryGroup } from '../../lib/api';
import { categoryOptionGroups, isHiddenOption } from '../categories/categories';

/** <option>s for a category <select>, grouped, keeping an archived current choice visible. */
export function CategoryOptions({
  groups,
  placeholder = 'Ready to assign',
  selected,
}: {
  groups: CategoryGroup[];
  placeholder?: string;
  selected?: { id: string; name: string };
}) {
  const optionGroups = categoryOptionGroups(groups);
  return (
    <>
      <option value="">{placeholder}</option>
      {optionGroups.map((group) => (
        <optgroup key={group.id} label={group.name}>
          {group.options.map((option) => (
            <option key={option.id} value={option.id}>
              {option.name}
            </option>
          ))}
        </optgroup>
      ))}
      {selected && isHiddenOption(optionGroups, selected.id) && (
        <option value={selected.id}>{selected.name}</option>
      )}
    </>
  );
}
