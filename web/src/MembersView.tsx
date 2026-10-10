import { FormEvent, useEffect, useState } from 'react';
import { Member, Role, api, errorMessage } from './api';

const RANK: Record<Role, number> = { viewer: 1, editor: 2, owner: 3 };
const ROLE_NAMES: Role[] = ['owner', 'editor', 'viewer'];

export function MembersView({
  budgetId,
  myRole,
}: {
  budgetId: string;
  myRole: Role;
}) {
  const [members, setMembers] = useState<Member[] | null>(null);
  const [email, setEmail] = useState('');
  const [role, setRole] = useState<Role>('viewer');
  const [error, setError] = useState<string | null>(null);

  const can = (minimum: Role) => RANK[myRole] >= RANK[minimum];

  const load = () =>
    api
      .listMembers(budgetId)
      .then(({ members }) => {
        setMembers(members);
        setError(null);
      })
      .catch((err) => setError(errorMessage(err)));

  useEffect(() => {
    load();
  }, [budgetId]);

  const addMember = async (e: FormEvent) => {
    e.preventDefault();
    if (!email.trim()) return;
    try {
      await api.addMember(budgetId, email.trim(), role);
      setEmail('');
      await load();
    } catch (err) {
      setError(errorMessage(err));
    }
  };

  const changeRole = async (member: Member, next: Role) => {
    if (next === member.role) return;
    try {
      await api.setMemberRole(budgetId, member.userId, next);
      await load();
    } catch (err) {
      setError(errorMessage(err));
    }
  };

  const removeMember = async (member: Member) => {
    try {
      await api.removeMember(budgetId, member.userId);
      await load();
    } catch (err) {
      setError(errorMessage(err));
    }
  };

  return (
    <section>
      {error && <div className="error">{error}</div>}

      <table className="members">
        <thead>
          <tr>
            <th>Name</th>
            <th>Email</th>
            <th>Role</th>
            <th className="right">Actions</th>
          </tr>
        </thead>
        <tbody>
          {members?.map((member) => (
            <tr key={member.userId}>
              <td>{member.name}</td>
              <td className="muted">{member.email}</td>
              <td>
                {can('owner') ? (
                  <select
                    className="select"
                    value={member.role}
                    aria-label={`Role of ${member.name}`}
                    onChange={(e) => changeRole(member, e.target.value as Role)}
                  >
                    {ROLE_NAMES.map((r) => (
                      <option key={r} value={r}>
                        {r}
                      </option>
                    ))}
                  </select>
                ) : (
                  <span className="role-badge owner">{member.role}</span>
                )}
              </td>
              <td className="right">
                {can('owner') && (
                  <button
                    className="btn-link danger"
                    onClick={() => removeMember(member)}
                  >
                    Remove
                  </button>
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>

      {can('owner') && (
        <>
          <h2 className="section-title">Add a member</h2>
          <form className="create-row" onSubmit={addMember}>
            <input
              className="input"
              type="email"
              placeholder="Their email, such as pat@example.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              aria-label="Member email"
            />
            <select
              className="select"
              value={role}
              onChange={(e) => setRole(e.target.value as Role)}
              aria-label="Role for the new member"
            >
              {ROLE_NAMES.map((r) => (
                <option key={r} value={r}>
                  {r}
                </option>
              ))}
            </select>
            <button className="btn btn-primary" disabled={!email.trim()}>
              Add member
            </button>
          </form>
          <p className="muted small">
            The person must already have a OneBudget account.
          </p>
        </>
      )}
    </section>
  );
}