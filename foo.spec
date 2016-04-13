Name:		hut-api
Version:	v0.0.1
Release:	1%{?dist}
Summary:	HUT API's

Group:		Applications/System
License:	GPLv3
URL:		http://gitlab.lsh.is/agustik/hut-api.git
Source0:	%{name}-%{version}.tar.gz

BuildRequires:	npm git
Requires:	    nodejs npm

BuildRoot:  %(mktemp -ud %{_tmppath}/%{name}-%{version}-%{release}-XXXXXX)
BuildArch:	noarch

%description
API For LSH-HUT


%prep
%setup -q -n %{name}-%{version}


%build
npm install

%install
test "x$RPM_BUILD_ROOT" != "x" && rm -rf $RPM_BUILD_ROOT
mkdir -p %{buildroot}/%{_datadir}/%{name}

cp -av lib/ %{buildroot}/%{_datadir}/%{name}
cp -av endpoints/ %{buildroot}/%{_datadir}/%{name}
cp pm2.json %{buildroot}/%{_datadir}/%{name}
cp services.js %{buildroot}/%{_datadir}/%{name}
cp index.js %{buildroot}/%{_datadir}/%{name}

mkdir -p %{buildroot}/%{_sysconfdir}/%{name}
install -Dp -m 644 config.js.editme %{buildroot}/%{_sysconfdir}/%{name}/config.js
ln -sf %{_sysconfdir}/%{name}/config.js %{buildroot}/%{_datadir}/%{name}/config.js



%changelog
