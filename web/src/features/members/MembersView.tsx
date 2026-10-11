import { FormEvent, useEffect, useState } from 'react';
import { Member, Role, api, errorMessage } from '../../lib/api';
import { hasRole } from '../../lib/roles';
import { Loading } from '../../lib/Loading';
import { useConfirm } from '../../lib/Modal';

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
  const [confirm, confirmDialog] = useConfirm();

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
    const ok = await confirm({
      title: `Remove ${member.name}?`,
      message: 'They lose access to this budget right away. You can add them again later.',
      confirmLabel: 'Remove',
      danger: true,
    });
    if (!ok) return;
    try {
      await api.removeMember(budgetId, member.userId);
      await load();
    } catch (err) {
      setError(errorMessage(err));
    }
  };

  return (
    <section>
      {error && <div className="error" role="alert">{error}</div>}

      {members === null ? (
        <Loading label="Loading members" />
      ) : (
      <div className="table-wrap">
      <table className="members">
        <caption className="visually-hidden">Budget members</caption>
        <thead>
          <tr>
            <th scope="col">Name</th>
            <th scope="col">Email</th>
            <th scope="col">Role</th>
            <th scope="col" className="right">Actions</th>
          </tr>
        </thead>
        <tbody>
          {members?.map((member) => (
            <tr key={member.userId}>
              <td>{member.name}</td>
              <td className="muted">{member.email}</td>
              <td>
                {hasRole(myRole, 'owner') ? (
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
                  <span className={`role-badge ${member.role}`}>{member.role}</span>
                )}
              </td>
              <td className="right">
                {hasRole(myRole, 'owner') && (
                  <button
                    type="button"
                    className="btn-link danger"
                    aria-label={`Remove ${member.name}`}
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
      </div>
      )}

      {hasRole(myRole, 'owner') && (
        <>
          <h2 className="section-title">Add a member</h2>
          <form className="create-row" onSubmit={addMember}>
            <input
              className="input"
              type="email"
              placeholder="Their email, such as pat@example.com"
              autoComplete="off"
              spellCheck={false}
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
      {confirmDialog}
    </section>
  );
}