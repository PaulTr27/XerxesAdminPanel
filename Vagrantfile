# -*- mode: ruby -*-
# vi: set ft=ruby :

Vagrant.configure("2") do |config|
  # 1. Base Box: Debian 13 - The foundation of current Raspberry Pi OS
  config.vm.box = "bento/debian-13"
  config.vm.box_version = "202510.26.0"

  # 2. Networking: Forward port 8080 to the host machine.
  # When your backend runs in the VM, you can view it at http://localhost:27272 on your native browser.
  config.vm.network "forwarded_port", guest: 8080, host: 27272

  # 3. File Sharing: Map the host project folder to /workspace inside the VM.
  config.vm.synced_folder ".", "/workspace"

  # 4. VM Hardware Configuration (VirtualBox)
  config.vm.provider "virtualbox" do |vb|
    vb.name = "xerxes-pi-dev-env"
    vb.memory = "2048" # 2GB RAM
    vb.cpus = 4 # Quadcore to simulate CM5 module
  end

  # 5. Automated Provisioning: Install all required system tools and Rust
  config.vm.provision "shell", inline: <<-SHELL
    # Stop apt from showing interactive dialogs during the automated install
    export DEBIAN_FRONTEND=noninteractive

    echo "Updating apt repositories..."
    apt-get update -y

    echo "Installing core system tools, Samba, and Docker..."
    apt-get install -y build-essential curl git wget samba docker.io

    # Allow the default 'vagrant' user to run Docker commands without sudo
    usermod -aG docker vagrant

    echo "Installing Rust toolchain for the vagrant user..."
    # We use 'su - vagrant' to ensure Rust is installed in the user's home directory, not root
    su - vagrant -c "curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs | sh -s -- -y"

    echo "======================================================"
    echo " Xerxes Pi Vagrant Environment is Ready!"
    echo " 1. Type 'vagrant ssh' to enter the machine."
    echo " 2. Navigate to 'cd /workspace' to see your code."
    echo "======================================================"
  SHELL
end