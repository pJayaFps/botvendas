const isAdmin = (member) => {
  if (!member) return false;
  return member.permissions.has('Administrator');
};

module.exports = { isAdmin };
