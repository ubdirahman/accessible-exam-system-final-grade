export default function SearchInput({ value, onChange, placeholder = 'Search...' }) {
    return (
        <div className="input-group" style={{ marginBottom: 0 }}>
            <label>Search</label>
            <div style={{ position: 'relative' }}>
                <i
                    className="fa-solid fa-magnifying-glass"
                    aria-hidden="true"
                    style={{
                        position: 'absolute',
                        left: 12,
                        top: '50%',
                        transform: 'translateY(-50%)',
                        color: 'var(--text-muted)'
                    }}
                ></i>
                <input
                    className="input"
                    value={value}
                    onChange={(event) => onChange(event.target.value)}
                    placeholder={placeholder}
                    style={{ paddingLeft: 38 }}
                />
            </div>
        </div>
    );
}
